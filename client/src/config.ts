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
