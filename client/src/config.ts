// ── Single source of truth for company + owner branding ──────────────────────
export const COMPANY = {
  name:        'Hira Packaging Solution',
  shortName:   'Hira Packaging',
  owner:       'Tushar Bansal',
  gst:         '07AADCN5812F1ZV',
  address:     'Plot 8, Industrial Area Phase-II, Delhi - 110020',
  phone:       '+919876543210',
  email:       'info@hirapackaging.com',
} as const;

// Order product types. Milky/Natural were removed here but remain valid roll
// types in inventory (see DEFAULT_ROLL_TYPES) — they describe stock, not orders.
export const PRODUCT_TYPES = ['BOPP', 'Laminated', 'Flexo', 'Plain'] as const;
export type ProductType = typeof PRODUCT_TYPES[number];

export const CONSUMABLE_CATEGORIES = ['Ink', 'Thread', 'Filler', 'Custom'] as const;
export type ConsumableCategory = typeof CONSUMABLE_CATEGORIES[number];

export const ORDER_STATUSES = ['Pending', 'In Production', 'QC Check', 'Ready', 'Dispatched'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

// Module 5 — CRM
export const LEAD_SOURCES  = ['Cold Call', 'Referral', 'Trade Show', 'Website'] as const;
export const LEAD_STATUSES = ['New', 'Contacted', 'Interested', 'Proposal Sent', 'Won', 'Lost'] as const;
export type LeadSource = typeof LEAD_SOURCES[number];
export type LeadStatus = typeof LEAD_STATUSES[number];

// Module 6 — Finance
export const INVOICE_STATUSES = ['Draft', 'Sent', 'Paid', 'Overdue'] as const;
export type InvoiceStatus = typeof INVOICE_STATUSES[number];
export const GST_RATE = 18; // %

// Module 7 — Vendors
export const PO_STATUSES = ['Draft', 'Sent', 'Confirmed', 'Delivered'] as const;
export type POStatus = typeof PO_STATUSES[number];

// Module 8 — Alert settings (stored in localStorage settings key)
export const ALERT_TYPES = ['LOW_STOCK', 'OVERDUE_ORDER', 'PAYMENT_DEFAULT', 'DISPATCH_DELAY', 'FOLLOW_UP', 'PO_DELAY'] as const;
export type AlertType = typeof ALERT_TYPES[number];

// Module 9 — WhatsApp
export const WHATSAPP_SETTINGS_KEY = 'packflow_settings';

// ── Module 10 — Production ─────────────────────────────────────────────────────
export const MACHINE_TYPES = ['Printing', 'Cutting', 'Bag Making', 'Lamination', 'Extrusion'] as const;
export type MachineType = typeof MACHINE_TYPES[number];

export const MACHINE_STATUSES = ['Running', 'Idle', 'Down', 'Maintenance'] as const;
export type MachineStatus = typeof MACHINE_STATUSES[number];

export const JOB_STATUSES = ['Queued', 'Running', 'On Hold', 'Completed'] as const;
export type JobStatus = typeof JOB_STATUSES[number];

export const DOWNTIME_REASONS = ['Breakdown', 'Maintenance', 'Material Shortage', 'Power Cut', 'Changeover', 'Other'] as const;
export type DowntimeReason = typeof DOWNTIME_REASONS[number];

// Roll consumption lifecycle — reflected in Materials → Rolls
export const ROLL_STATUSES = ['In Stock', 'In Use', 'Fully Used'] as const;
export type RollStatus = typeof ROLL_STATUSES[number];

// ── Shared — production shifts ─────────────────────────────────────────────────
export const SHIFTS = ['Morning', 'Afternoon', 'Night'] as const;
export type Shift = typeof SHIFTS[number];

// ── Module 11 — PP Fabric (Tape) Production ────────────────────────────────────
export const BATCH_STATUSES = ['Open', 'Closed'] as const;
export type BatchStatus = typeof BATCH_STATUSES[number];

export const WASTAGE_TYPES = ['Startup waste', 'Edge trim', 'Breakage', 'Colour change purge', 'Other'] as const;
export type WastageType = typeof WASTAGE_TYPES[number];

export const WASTAGE_ACTIONS = ['Recycled back', 'Sold as scrap', 'Disposed'] as const;
export type WastageAction = typeof WASTAGE_ACTIONS[number];

// ── Module 12 — Loom Production ────────────────────────────────────────────────
export const QUALITY_GRADES = ['A-Grade', 'B-Grade', 'Rejection'] as const;
export type QualityGrade = typeof QUALITY_GRADES[number];

export const LOOM_STATUSES = ['Active', 'Under maintenance', 'Retired'] as const;
export type LoomStatus = typeof LOOM_STATUSES[number];

export const WIDTH_UNITS = ['inches', 'mm'] as const;
export type WidthUnit = typeof WIDTH_UNITS[number];

export const LOOM_DOWNTIME_REASONS = ['Breakdown', 'Power cut', 'Material shortage', 'Other'] as const;
export type LoomDowntimeReason = typeof LOOM_DOWNTIME_REASONS[number];

// Standard working hours per shift — used for loom efficiency %. Configurable in Settings.
export const DEFAULT_SHIFT_HOURS = 8;

// ── Module 13 — Job Card (Order Traveler + Live Costing) ───────────────────────
export const FINISHES = ['Glossy', 'Matte', 'Metalized'] as const;
export type Finish = typeof FINISHES[number];

// Stages in the exact order the order physically travels the floor
export const JOB_STAGES = ['Printing', 'Metalize', 'Slitting', 'Lamination', 'Cutting', 'Dispatch'] as const;
export type JobStage = typeof JOB_STAGES[number];

export const JOBCARD_STATUSES = ['In Progress', 'Dispatched'] as const;
export type JobCardStatus = typeof JOBCARD_STATUSES[number];

// Order → Production routing. Making Type applies only to BOPP product type.
export const MAKING_TYPES = ['Roll', 'Bag'] as const;
export type MakingType = typeof MAKING_TYPES[number];

// Job card variant: BOPP (full traveler) vs Other (Cutting → Printing → Dispatch)
export const CARD_TYPES = ['BOPP', 'Other'] as const;
export type CardType = typeof CARD_TYPES[number];

// Dispatch records are tagged by type (roll vs finished bags)
export const DISPATCH_TYPES = ['Roll', 'Bag'] as const;
export type DispatchType = typeof DISPATCH_TYPES[number];

// ── Module 14 — Inventory defaults (reusable, extensible lists) ─────────────────
export const DEFAULT_ROLL_TYPES = ['Milky', 'Natural', 'Lamination', 'Milky Multi Colour'];
export const DEFAULT_RAW_MATERIALS = [
  'Gravure ink', 'Ethyl acetate', 'Toluene', 'MIBK', 'IPA', 'Thinner',
  'Adhesive', 'Hardener', 'P.P.', 'Filler', 'LD', 'Thread', 'Hot melt glue',
];
export const ROLL_TYPES_KEY = 'list_roll_types';
export const RAW_MATERIALS_KEY = 'list_raw_materials';

// Supplier/party names — reusable type-ahead list (raw materials + inventory rolls).
export const PARTIES_KEY = 'list_parties';
export const DEFAULT_PARTIES: string[] = [];

// Roll size+GM group labels — reusable type-ahead for bulk roll add.
export const ROLL_SIZEGM_KEY = 'list_roll_sizegm';
export const DEFAULT_ROLL_SIZEGM: string[] = [];

// P.P. Granule stock — named items are typed as one of these (extensible).
// "Master Batch" was formerly "RP". Enhancer added per the shop-floor list.
export const GRANULE_TYPES = ['P.P.', 'Filler', 'Master Batch', 'Colour', 'Enhancer'] as const;
export type GranuleType = typeof GRANULE_TYPES[number];
export const DEFAULT_GRANULE_TYPES = [...GRANULE_TYPES];
export const GRANULE_TYPES_KEY = 'list_granule_types';
// Type colours for the inventory list
export const GRANULE_TYPE_COLORS: Record<string, string> = {
  'P.P.':         'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'Filler':       'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'Master Batch': 'bg-green-500/15 text-green-300 border-green-500/30',
  'Colour':       'bg-purple-500/15 text-purple-300 border-purple-500/30',
  'Enhancer':     'bg-teal-500/15 text-teal-300 border-teal-500/30',
};
// Hex colours per granule type for the live mix bar / charts
export const GRANULE_TYPE_HEX: Record<string, string> = {
  'P.P.': '#3131B5', 'Filler': '#f59e0b', 'Master Batch': '#12B76A', 'Colour': '#a855f7', 'Enhancer': '#14b8a6',
};
// Fallbacks for user-added (extensible) types not in the maps above
export const GRANULE_FALLBACK_COLOR = 'bg-slate-500/15 text-slate-300 border-slate-500/30';
export const GRANULE_FALLBACK_HEX = '#64748b';
export const granuleTypeColor = (t: string) => GRANULE_TYPE_COLORS[t] ?? GRANULE_FALLBACK_COLOR;
export const granuleTypeHex = (t: string) => GRANULE_TYPE_HEX[t] ?? GRANULE_FALLBACK_HEX;

// Default avg bag weight (kg) used when bags are entered without an explicit weight
export const DEFAULT_BAG_WEIGHT_KG = 25;

// GRN receiving destinations (which inventory to increment)
export const GRN_DESTINATIONS = ['Raw Materials', 'BOPP Film', 'Rolls', 'P.P. Granule'] as const;
export type GrnDestination = typeof GRN_DESTINATIONS[number];

// User roles (also in types/index for the auth User)
export const USER_ROLES = ['OWNER', 'MANAGER', 'STAFF'] as const;

export const FABRIC_TYPES = ['NW', 'MW'] as const;
export type FabricType = typeof FABRIC_TYPES[number];

export const COATING_SIDES = ['Both Side', 'Single Side'] as const;
export type CoatingSide = typeof COATING_SIDES[number];

export const BCS_OPTIONS = [1, 2, 3, 4] as const;

// ── Machines master — extensible machine types the factory can add ──────────────
export const DEFAULT_MACHINE_TYPES = ['Cutting/BCS', 'Loom', 'Printing', 'Flexo', 'Lamination', 'Slitting', 'Metalize'];
export const MACHINE_TYPES_KEY = 'list_machine_types';

// ── Auto-calculated consumption percentages ────────────────────────────────────
// Ink is auto-filled as a % of BOPP input kg, thread as a % of cutting input kg.
// Both defaults are set in Settings and can be overridden per job card.
export const INK_PCT_KEY = 'auto_ink_pct';
export const THREAD_PCT_KEY = 'auto_thread_pct';
export const DEFAULT_INK_PCT = 10;      // dry gravure ink is well under 15% of substrate weight
export const DEFAULT_THREAD_PCT = 2;

// Materials the job card draws straight from Raw Materials, by stage. Names are
// matched case-insensitively against the raw-material item list.
export const PRINTING_SOLVENTS = ['Ethyl acetate', 'Toluene', 'MIBK', 'IPA'];
export const PRINTING_INK = 'Gravure ink';
export const METALIZE_MATERIALS = ['Adhesive', 'Hardener'];
export const LAMINATION_MATERIALS = ['P.P.', 'Filler', 'LD'];
export const BCS_THREAD = 'Thread';
export const BACKSEAL_GLUE = 'Hot melt glue';

// Cutting methods — the two ways bags are cut on the floor.
export const CUTTING_METHODS = ['BCS', 'Back Seal'] as const;
export type CuttingMethod = typeof CUTTING_METHODS[number];

// ── Staff process assignment (per-job Staff scoping) ────────────────────────────
// A Staff user is tied to ONE process and, when logged in, sees only that
// process across all job cards (or only the Loom / P.P. Unit pages). Extensible.
export const DEFAULT_PROCESSES = [
  'Printing', 'Slitting', 'Metalize', 'Lamination', 'Cutting-BCS', 'Back Seal', 'Dispatch', 'Loom', 'P.P. Unit',
];
export const PROCESSES_KEY = 'list_staff_processes';

// Bag Type — reusable type-ahead list (order + job-card header). Extensible.
export const DEFAULT_BAG_TYPES = ['Handle', 'Laminated', 'Non-laminated'];
export const BAG_TYPES_KEY = 'list_bag_types';

// Rate Master categories — a labour/overhead line belongs to one stage (or 'Any')
export const RATE_CATEGORIES = ['Printing', 'Metalize', 'Slitting', 'Lamination', 'Cutting', 'Dispatch', 'Any'] as const;
export type RateCategory = typeof RATE_CATEGORIES[number];

// The Rate Master no longer prices materials — raw materials, rolls and BOPP film
// are costed from the rate of the batch actually consumed (see lib/batches.ts).
// What remains here is labour and machine/overhead conversion cost per stage.
export const RATE_MASTER_SEED: { name: string; unit: string; rate: number | null; category: RateCategory }[] = [
  { name: 'Printing labour',        unit: '₹/kg',   rate: 6,    category: 'Printing' },
  { name: 'Printing machine hour',  unit: '₹/kg',   rate: 4,    category: 'Printing' },
  { name: 'Metalize conversion',    unit: '₹/kg',   rate: 12,   category: 'Metalize' },
  { name: 'Slitting labour',        unit: '₹/kg',   rate: 3,    category: 'Slitting' },
  { name: 'Lamination labour',      unit: '₹/kg',   rate: 5,    category: 'Lamination' },
  { name: 'Cutting labour',         unit: '₹/kg',   rate: 4,    category: 'Cutting' },
  { name: 'Packing labour',         unit: '₹/bale', rate: 10,   category: 'Dispatch' },
  { name: 'Factory overhead',       unit: '₹/kg',   rate: null, category: 'Any' },
];
