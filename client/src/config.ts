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

export const PRODUCT_TYPES = ['BOPP', 'UL', 'Natural', 'Laminated'] as const;
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

// Order → Production routing
export const PRODUCT_CATEGORIES = ['BOPP Bag', 'Other Bag'] as const;
export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const MAKING_TYPES = ['Roll Making', 'Bag Making'] as const;
export type MakingType = typeof MAKING_TYPES[number];

// Job card variant: BOPP (full traveler) vs Normal (Printing → Cutting → Dispatch)
export const CARD_TYPES = ['BOPP', 'Normal'] as const;
export type CardType = typeof CARD_TYPES[number];

// Dispatch records are tagged by type (roll vs finished bags)
export const DISPATCH_TYPES = ['Roll', 'Bag'] as const;
export type DispatchType = typeof DISPATCH_TYPES[number];

export const FABRIC_TYPES = ['NW', 'MW'] as const;
export type FabricType = typeof FABRIC_TYPES[number];

export const COATING_SIDES = ['Both Side', 'Single Side'] as const;
export type CoatingSide = typeof COATING_SIDES[number];

export const BCS_OPTIONS = [1, 2, 3, 4] as const;

// Rate Master categories — a material belongs to one stage (or 'Any')
export const RATE_CATEGORIES = ['Printing', 'Metalize', 'Slitting', 'Lamination', 'Cutting', 'Dispatch', 'Any'] as const;
export type RateCategory = typeof RATE_CATEGORIES[number];

// Seed list for the Rate Master (owner can add/edit/delete more). Rates are
// indicative INR demo values — the owner maintains the real numbers.
export const RATE_MASTER_SEED: { name: string; unit: string; rate: number | null; category: RateCategory }[] = [
  { name: 'BOPP film – Glossy',          unit: '₹/kg',   rate: 165,  category: 'Printing' },
  { name: 'BOPP film – Matte',           unit: '₹/kg',   rate: 172,  category: 'Printing' },
  { name: 'BOPP film – Metalized',       unit: '₹/kg',   rate: 188,  category: 'Printing' },
  { name: 'BOPP film – Pearl',           unit: '₹/kg',   rate: 178,  category: 'Printing' },
  { name: 'Gravure ink',                 unit: '₹/kg',   rate: 240,  category: 'Printing' },
  { name: 'Ethyl acetate',               unit: '₹/kg',   rate: 95,   category: 'Printing' },
  { name: 'Toluene',                     unit: '₹/kg',   rate: 88,   category: 'Printing' },
  { name: 'IPA',                         unit: '₹/kg',   rate: 110,  category: 'Printing' },
  { name: 'Metalizing (aluminium)',      unit: '₹/kg',   rate: 320,  category: 'Metalize' },
  { name: 'Slitting core',               unit: '₹/pc',   rate: 18,   category: 'Slitting' },
  { name: 'LDPE granules',               unit: '₹/kg',   rate: 105,  category: 'Lamination' },
  { name: 'Woven fabric',                unit: '₹/kg',   rate: 142,  category: 'Lamination' },
  { name: 'PU adhesive',                 unit: '₹/kg',   rate: 215,  category: 'Lamination' },
  { name: 'Hardener',                    unit: '₹/kg',   rate: 260,  category: 'Lamination' },
  { name: 'Sewing thread',               unit: '₹/kg',   rate: 180,  category: 'Cutting' },
  { name: 'Crepe paper tape',            unit: '₹/roll', rate: 35,   category: 'Cutting' },
  { name: 'Packing (bale wrap + strap)', unit: '₹/bale', rate: 28,   category: 'Dispatch' },
  { name: 'Labour/machine (optional)',   unit: '₹/kg',   rate: null, category: 'Any' },
];
