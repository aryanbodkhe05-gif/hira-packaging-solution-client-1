// ── Single source of truth for company + owner branding ──────────────────────
export const COMPANY = {
  name:        'Nico Flex Pvt Ltd',
  shortName:   'Nico Flex',
  owner:       'Tushar Bansal',
  gst:         '07AADCN5812F1ZV',
  address:     'Plot 8, Industrial Area Phase-II, Delhi - 110020',
  phone:       '+919876543210',
  email:       'info@nicoflexpvt.com',
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
