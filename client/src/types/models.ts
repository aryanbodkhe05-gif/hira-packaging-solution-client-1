import type { ProductType, ConsumableCategory, OrderStatus, POStatus, MachineType, MachineStatus, JobStatus, DowntimeReason, RollStatus, Shift, BatchStatus, WastageType, WastageAction, QualityGrade, LoomStatus, WidthUnit, Finish, JobStage, JobCardStatus, FabricType, CoatingSide, RateCategory, MakingType, CardType, CuttingMethod, DispatchType, GrnDestination } from '../config';

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
// A production unit (Loom / P.P.). Default two; extensible. Names editable in Settings.
export interface Unit {
  id: string;               // stable id, e.g. 'unit-1'
  name: string;             // editable display name
}

export interface FabricBatch {
  id: string;
  unitId?: string;          // which Loom/P.P. unit this belongs to (default 'unit-1')
  batchId: string;          // HIRA-YYYYMMDD-NNN
  date: string;             // yyyy-mm-dd
  shift: Shift;
  line: string;             // e.g. "Line 3"
  uses: GranuleUse[];       // granule items consumed (P.P / Filler / RP / Colour) — deducted from stock
  outputMeters?: number;    // total fabric produced (meters)
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
  unitId?: string;          // which Loom/P.P. unit this belongs to (default 'unit-1')
  entryId: string;          // LM-YYYYMMDD-NNN
  date: string;             // yyyy-mm-dd
  shift: Shift;
  loomNo: string;
  operator?: string;
  width: number;            // fabric width / size
  widthUnit: WidthUnit;     // inches | mm
  meters: number;           // total meters woven
  quality: number;          // numeric grade (e.g. 2.5), matching Order quality format
  weightKg: number;         // weight of produced roll/batch
  rollCount: number;
  reedCount?: number;
  rpm?: number;             // loom RPM if tracked
  granuleUses?: GranuleUse[]; // granule consumption (auto-decrements P.P. Granule stock)
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

// One slice of a consumption row drawn from a single raw-material batch. A row
// spanning two batches (300 kg needed, oldest batch has 200) produces two lots,
// each priced at its own batch rate.
export interface ConsumptionLot {
  batchId: string;
  qty: number;
  rate: number | null;          // ₹/unit snapshotted from the batch at entry time
  batchDate: string;            // batch receipt date — shown in the cost breakdown
  lineCost: number;             // qty × rate (0 when rate not set)
}

// One material consumed in a stage. Rates are snapshotted at entry time so later
// batch/rate edits never retroactively change historical job costs.
export interface Consumption {
  materialId: string;
  materialName: string;
  unit: string;
  qty: number;
  rateSnapshot: number | null;  // effective (weighted-average) rate across lots; null => unpriced
  lineCost: number;             // sum of lot line costs
  lots?: ConsumptionLot[];      // FIFO breakdown — one entry per batch consumed
  source?: 'batch' | 'labour';  // 'labour' rows are priced from the Rate Master
  shortfall?: number;           // qty that no batch could cover (stock ran out)
}

// One roll / BOPP film consumed by a stage. Each roll gets its own line and is
// costed at that specific roll's rate — never a pooled or averaged rate.
export interface RollUse {
  rollId: string;
  rollNo: string;
  kind: 'roll' | 'film';        // inv_rolls vs inv_bopp_films
  type?: string;                // roll type (Milky / Natural / …)
  size?: string;
  qtyKg: number;                // weight consumed from this roll
  rate: number | null;          // ₹/kg snapshotted from the roll; null => not set
  lineCost: number;             // qtyKg × rate (0 when rate not set)
  finished: boolean;            // true => roll fully used, archived to Finished
  balanceKg?: number;           // weight left on the roll when not finished
}

// (legacy) manual batch-pick line — superseded by auto-FIFO MaterialUse below.
export interface BatchUse {
  id: string;
  materialId: string;
  materialName: string;
  unit: string;
  batchId: string;
  batchDate?: string;
  qty: number;
  rate: number | null;
  lineCost: number;
}

// ── Moving-average raw-material consumption ─────────────────────────────────────
// Each raw material is ONE pool (see RawMaterial). The worker enters a quantity;
// it is charged at the pool's current moving-average rate, snapshotted here at
// entry time so later receipts never change historical job costs. No batches.
export interface MaterialUse {
  materialId: string;
  materialName: string;
  unit: string;
  qty: number;                  // quantity consumed
  avgRate: number | null;       // ₹/unit — pool average at entry; null when the pool is unrated
  cost: number;                 // qty × avgRate (0 when unrated)
  shortfall?: number;           // qty the pool couldn't cover (blocked at entry, so normally 0)
}

interface StageBase {
  na: boolean;                  // stage marked Not Applicable
  date?: string;
  operator?: string;
  consumption: Consumption[];   // legacy (auto-FIFO lots) — migrated into materials
  materialUses?: BatchUse[];    // legacy (manual batch-pick) — migrated into materials
  materials?: MaterialUse[];    // auto-FIFO consumption (current)
  rollUses?: RollUse[];         // per-roll consumption lines (Printing, Lamination)
}

export interface PrintingStage extends StageBase {
  inputKg?: number;             // BOPP Input (kg)
  boppSize?: string;            // BOPP Size
  boppRollNo?: string;          // BOPP Roll No
  boppType?: string;            // BOPP Type
  balanceKg?: number;           // Balance BOPP
  outputKg?: number;
  meter?: number;               // Output (meter)
  rejectionKg?: number;         // Wastage
  inkPct?: number;              // ink auto-calc %, overrides the Settings default
  inkManual?: boolean;          // true once the operator types over the auto ink qty
  noOfBags?: number;            // Other card printing
  colour?: string;             // Other card printing — colour of print
  ink?: number;                // Other card printing — ink consumption (kg)
  thinner?: number;            // Other card printing — thinner consumption (kg)
}

export interface MetalizeStage extends StageBase {
  rollNo?: string;
  size?: string;
  rollBalance?: string;         // balance roll no / remaining roll after this run
  metalizeInputKg?: number;
  boppInputKg?: number;
  outputKg?: number;
  outputMtr?: number;
  rejectionKg?: number;
  balanceKg?: number;
}

export interface SlittingRoll { outputKg?: number; desc?: string; core?: string; meter?: number; }
export interface SlittingStage extends StageBase {
  inputKg?: number;
  inputMeter?: number;
  outputKg?: number;
  outputMeter?: number;
  balanceKg?: number;
  balanceMeter?: number;
  rejectionKg?: number;         // Wastage
  grossInputKg?: number;        // legacy — superseded by inputKg
  inputCoreKg?: number;
  rolls: SlittingRoll[];        // legacy per-roll outputs, kept for old cards
  trimKg?: number;
}

export interface LaminationRow { boppInKg?: number; fabricInKg?: number; meter?: number; outKg?: number; }
export interface LaminationStage extends StageBase {
  fabricSize?: string;
  fabricType?: FabricType;
  rollNo?: string;              // Roll No + Size are captured per roll in rollUses
  size?: string;
  grm?: number;
  coating?: string;
  coatingSide?: CoatingSide;
  avg?: number;
  rows: LaminationRow[];        // up to 3
  totalRoll?: number;
  balanceRoll?: number;
  rejectionKg?: number;
  balanceKg?: number;
  // Other/Flexo card lamination extras
  inputKg?: number;
  outputKg?: number;
  balanceRollNo?: string;
}

export interface CuttingRow { inputKg?: number; noOfBags?: number; bcs?: number; machine?: string; rollNo?: string }
export interface CuttingStage extends StageBase {
  method?: CuttingMethod;       // 'BCS' (default) | 'Back Seal'
  gusset: boolean;
  perforation: boolean;
  rows: CuttingRow[];           // BCS rows — up to 3
  balance?: number;
  rejectionKg?: number;         // Wastage
  threadPct?: number;           // BCS: thread auto-calc %, overrides the Settings default
  threadManual?: boolean;       // true once the operator types over the auto thread qty
  // Back Seal
  bsInputKg?: number;
  bsBalanceKg?: number;
  bsPieces?: number;
}

export interface DispatchLine {
  quantityKg?: number;          // Qty (kg) — may be blank
  pieces?: number;              // Qty (bags/pcs) — actually shipped; may be blank
  dispatchDate?: string;
  fromCardId?: string;          // legacy carried-line — no longer used (see carriedIn)
  fromLabel?: string;
}
// A ready-to-dispatch balance MOVED onto this card from a sibling job card via the
// carry button. On move it leaves the source (its ready → 0) and becomes this
// card's to dispatch. Kept separate from newly-made dispatch lines.
export interface CarriedIn {
  id: string;
  fromCardId: string;
  fromLabel: string;            // e.g. "JC-1"
  pieces: number;
  kg?: number;
  movedAt: string;
}
export interface DispatchStage extends StageBase {
  pendingKg?: number;
  pendingPcs?: number;
  lines: DispatchLine[];
  carriedIn?: CarriedIn[];      // balances moved in from sibling cards
  bagsPerBale?: number;
  noOfBales?: number;
  balanceKg?: number;
}

export interface JobCardHeader {
  brand: string;
  qty: number;
  size: string;
  finish: Finish;
  date: string;
  bagType?: string;         // reusable type-ahead (handle/laminated/…)
  boppFilmSizes?: string[]; // BOPP film sizes in mm, carried from the order
  metalizeSize?: string;    // mm, carried from the order
  linerSize?: string;       // mm, carried from the order
  linerGrm?: number;        // carried from the order
  qtyUnit?: 'Nos' | 'Kg';   // Other card — Nos/Kg indicator
  printed?: boolean;        // Other card — Plain (false) / Printed (true)
}

// A finished-goods dispatch posted from a job card's dispatch point.
export interface DispatchRecord {
  id: string;
  type: DispatchType;           // 'Roll' | 'Bag'
  jobCardId?: string;           // set when dispatched from a Job Card
  rollId?: string;              // set when dispatched directly from roll inventory
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
  billNo?: string;              // optional, added/edited after the dispatch is created
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
  orderJobSeq?: number;         // JC-n sequence within the order (1,2,3…)
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
  gm?: number;             // GM (grams/GSM) — groups rolls with size for bulk add + numbering
  quality: number;         // legacy grade — kept for old rolls; superseded by gm for grouping
  gWt: number;             // gross weight (kg)
  nWt: number;             // net weight (kg)
  meter: number;
  avg?: number;            // per-roll Avg (as entered on the shop floor)
  rate?: number | null;    // ₹/kg for THIS roll, captured at receipt; null => not set
  party?: string;          // supplier/party; "Hira Packaging" when transferred from our own unit
  inTransit?: boolean;     // transferred from a Loom/P.P. unit, awaiting Receive in Inventory
  fromUnitId?: string;     // the unit a transferred roll came from
  dateAdded: string;       // auto-captured entry date (yyyy-mm-dd)
  balanceUsed?: boolean;   // flagged when partially consumed in production
  dispatched?: boolean;    // flagged when dispatched directly from stock
  dispatchedAt?: string;
}

// Consumables: ink, thread, thinner, solvents, etc. Held as ONE moving-average
// pool. Receipts add stock at their own rate and update the blended average;
// consumption is charged at the current average and leaves the average unchanged.
// Everything below `unit` is DERIVED by syncMaterialPools() from the receipt log
// and card consumption — never edited directly.
export interface RawMaterial {
  id: string;
  name: string;            // from reusable item list (type-ahead)
  unit: string;
  quantity: number;        // rated stock on hand = Σ rated receipts − Σ consumed
  totalValue: number;      // ₹ value of the rated stock on hand
  avgRate: number | null;  // totalValue / quantity; null when there is no rated stock
  unratedQty: number;      // stock received without a rate — excluded from avg/value until priced
  dateAdded: string;
}

// One receipt of a raw material into its pool — the audit trail of what was
// received at what rate. Costing uses the pooled moving average, not individual
// receipts. A null rate = unrated stock, folded into the pool once priced.
export interface RawMaterialReceipt {
  id: string;
  materialId: string;
  qty: number;             // qty received
  rate: number | null;     // ₹/unit at receipt; null => "rate not set"
  date: string;            // receipt date (yyyy-mm-dd)
  party?: string;          // supplier / party this stock came from
  billNo?: string;         // supplier bill / invoice no.
  grnRef?: string;         // GRN no. when received via a GRN
  note?: string;
  createdAt: string;
}

// (legacy) discrete FIFO batch — read once by the moving-average migration, then
// superseded by RawMaterialReceipt. No runtime code depends on it any more.
export interface RawMaterialBatch {
  id: string;
  materialId: string;
  qty: number;
  remaining: number;
  rate: number | null;
  date: string;
  grnRef?: string;
  note?: string;
  createdAt: string;
}

// A roll made inside a Loom/P.P. unit (its own stock). Transferred to Inventory
// Rolls via the two-step transfer → receive flow.
export interface UnitRoll {
  id: string;
  unitId: string;          // which unit made/holds this roll
  type?: string;
  size: string;
  gm?: number;
  gWt: number;
  nWt: number;
  meter: number;
  avg?: number;
  status: 'in_unit' | 'in_transit';   // in_transit = sent out, awaiting Inventory Receive
  createdAt: string;
}

// Machines master (purpose-built) — the actual machines the factory has. Feeds
// the Cutting/BCS selector on job cards and the Loom selector on the Loom Log.
export interface FactoryMachine {
  id: string;
  name: string;            // machine name / number, e.g. "Cutting-1", "Loom 3"
  type: string;            // extensible: Cutting/BCS, Loom, Printing, Flexo, Lamination, Slitting, Metalize
  active: boolean;
  createdAt: string;
}

// Supplier master
export interface Supplier {
  id: string;
  name: string;
  contact: string;
  gst: string;
  materials: string;       // materials supplied (free text)
  createdAt: string;
}

// Goods Receipt Note — standalone (no PO). Increments one inventory destination.
export interface GRN {
  id: string;
  grnNo: string;           // GRN-YYYYMMDD-NNN
  supplier: string;
  invoiceNo: string;
  date: string;            // yyyy-mm-dd
  destination: GrnDestination;
  itemName: string;        // material / film no / roll no / granule type
  qty: number;             // primary qty (kg or count)
  unit?: string;
  bags?: number;           // granules
  meter?: number;          // film / rolls
  createdAt: string;
}

// P.P. Granule stock — named items with a directly-deducted current stock.
// P.P and Filler (and RP, Colour) are tracked as separate items.
export interface PPGranuleItem {
  id: string;
  unitId?: string;         // which Loom/P.P. unit this belongs to (default 'unit-1')
  name: string;            // e.g. "Virgin PP Grade A", "CaCO3 Filler 80%"
  type: string;            // reusable, extensible (P.P. | Filler | RP | Colour | …)
  supplier?: string;
  costPerKg?: number;
  currentStockKg: number;  // running balance (kg) — deducted when used in PP Fabric
  bagWeightKg?: number;    // avg kg per bag (kg ÷ bags at receipt) — drives bags-remaining
  dateReceived: string;    // auto-captured receipt date (yyyy-mm-dd)
  minStockAlert?: number;
  grnRef?: string;
  createdAt: string;
  updatedAt: string;
}

// One granule item consumed by a PP Fabric batch (qty deducted from its stock).
export interface GranuleUse {
  itemId: string;
  itemName: string;
  type: string;
  qtyKg: number;
}

// Incoming BOPP film raw stock (before printing).
// Incoming BOPP film stock — inward like rolls: grouped by size, per-film rate.
export interface BoppFilm {
  id: string;
  filmNo: string;
  size?: string;           // film size (mm) — groups films like rolls group by size
  gWt?: number;            // gross weight (kg)
  nWt?: number;            // net weight (kg) — the consumable stock weight
  kg: number;              // legacy alias for nWt, kept in sync for older consumers
  meter: number;
  finish?: Finish;         // glossy / matte / metalized / pearl (optional)
  micron?: number;         // optional legacy field
  rate?: number | null;    // ₹/kg for THIS film, captured at receipt; null => not set
  party?: string;          // supplier/party this film was bought from
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
  brandName: string;
  productType: ProductType;
  length: number;
  width: number;
  grm: number;
  sizeDisplay: string;      // "25 × 30 + 0.96 gm"
  quantityKg?: number;
  quantityNos?: number;
  quantityUnit: 'KG' | 'Nos' | 'Both';
  status: OrderStatus;
  bagType?: string;                    // reusable type-ahead (handle/laminated/…)
  boppFilmSizes?: string[];            // one or more BOPP film sizes in mm — all optional
  metalizeSize?: string;               // mm, optional
  linerSize?: string;                  // mm, optional
  linerGrm?: number;                   // optional
  // Production routing (Sales → Production). Making Type applies only to BOPP.
  makingType?: MakingType;             // when BOPP: 'Roll' | 'Bag'
  jobCardId?: string;                  // linked Job Card once sent to production
  closedAt?: string;                   // set when short-closed (Part H)
  closedBy?: string;
  closeReason?: string;
  notes?: string;
  billNo?: string;
  dispatchDate?: string;
  createdAt: string;
  dispatchedAt?: string;
}
