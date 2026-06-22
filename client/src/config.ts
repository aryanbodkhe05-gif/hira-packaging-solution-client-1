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

// Module 8 — Alert settings (stored in localStorage key 'nicoflex_settings')
export const ALERT_TYPES = ['LOW_STOCK', 'OVERDUE_ORDER', 'PAYMENT_DEFAULT', 'DISPATCH_DELAY', 'FOLLOW_UP', 'PO_DELAY'] as const;
export type AlertType = typeof ALERT_TYPES[number];

// Module 9 — WhatsApp
export const WHATSAPP_SETTINGS_KEY = 'nicoflex_settings';

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
