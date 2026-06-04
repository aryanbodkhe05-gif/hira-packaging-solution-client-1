import { dbSeedOnce } from './db';
import type { Roll, Consumable, Order } from '../types/models';
import type { ProductType, OrderStatus } from '../config';

// ── Rolls seed ────────────────────────────────────────────────────────────────
const rollsSeed: Roll[] = [
  { id: 'r1',  rollNo: 'NF-R-001', type: 'BOPP',      size: '500mm × 5000m', quality: 'Premium', meter: 5000, grossWeight: 82.5,  netWeight: 80.0,  createdAt: '2026-01-10T08:00:00Z' },
  { id: 'r2',  rollNo: 'NF-R-002', type: 'BOPP',      size: '400mm × 4500m', quality: 'Standard', meter: 4500, grossWeight: 68.0,  netWeight: 65.5,  createdAt: '2026-01-15T08:00:00Z' },
  { id: 'r3',  rollNo: 'NF-R-003', type: 'Laminated', size: '600mm × 6000m', quality: 'Premium', meter: 6000, grossWeight: 110.0, netWeight: 107.2, createdAt: '2026-02-01T08:00:00Z' },
  { id: 'r4',  rollNo: 'NF-R-004', type: 'UL',        size: '350mm × 3500m', quality: 'Standard', meter: 3500, grossWeight: 48.5,  netWeight: 46.8,  createdAt: '2026-02-10T08:00:00Z' },
  { id: 'r5',  rollNo: 'NF-R-005', type: 'Natural',   size: '450mm × 4000m', quality: 'Economy',  meter: 4000, grossWeight: 55.0,  netWeight: 53.0,  createdAt: '2026-02-20T08:00:00Z' },
  { id: 'r6',  rollNo: 'NF-R-006', type: 'BOPP',      size: '500mm × 5000m', quality: 'Premium', meter: 5000, grossWeight: 83.0,  netWeight: 80.5,  createdAt: '2026-03-05T08:00:00Z' },
  { id: 'r7',  rollNo: 'NF-R-007', type: 'Laminated', size: '550mm × 5500m', quality: 'Premium', meter: 5500, grossWeight: 98.5,  netWeight: 96.0,  createdAt: '2026-03-12T08:00:00Z' },
  { id: 'r8',  rollNo: 'NF-R-008', type: 'UL',        size: '400mm × 4000m', quality: 'Standard', meter: 4000, grossWeight: 55.0,  netWeight: 53.5,  createdAt: '2026-03-18T08:00:00Z' },
  { id: 'r9',  rollNo: 'NF-R-009', type: 'Natural',   size: '300mm × 3000m', quality: 'Economy',  meter: 3000, grossWeight: 36.0,  netWeight: 34.5,  createdAt: '2026-04-02T08:00:00Z' },
  { id: 'r10', rollNo: 'NF-R-010', type: 'BOPP',      size: '600mm × 6000m', quality: 'Premium', meter: 6000, grossWeight: 99.0,  netWeight: 96.5,  createdAt: '2026-04-08T08:00:00Z' },
  { id: 'r11', rollNo: 'NF-R-011', type: 'Laminated', size: '400mm × 4500m', quality: 'Standard', meter: 4500, grossWeight: 72.0,  netWeight: 70.0,  createdAt: '2026-04-15T08:00:00Z' },
  { id: 'r12', rollNo: 'NF-R-012', type: 'UL',        size: '500mm × 5000m', quality: 'Premium', meter: 5000, grossWeight: 76.0,  netWeight: 74.0,  createdAt: '2026-05-01T08:00:00Z' },
  { id: 'r13', rollNo: 'NF-R-013', type: 'BOPP',      size: '450mm × 4500m', quality: 'Standard', meter: 4500, grossWeight: 70.5,  netWeight: 68.5,  createdAt: '2026-05-10T08:00:00Z' },
  { id: 'r14', rollNo: 'NF-R-014', type: 'Natural',   size: '350mm × 3500m', quality: 'Economy',  meter: 3500, grossWeight: 44.0,  netWeight: 42.5,  createdAt: '2026-05-18T08:00:00Z' },
  { id: 'r15', rollNo: 'NF-R-015', type: 'Laminated', size: '600mm × 6000m', quality: 'Premium', meter: 6000, grossWeight: 108.0, netWeight: 105.5, createdAt: '2026-06-01T08:00:00Z' },
];

// ── Consumables seed ──────────────────────────────────────────────────────────
const consumablesSeed: Consumable[] = [
  { id: 'c1', category: 'Ink',    name: 'White Ink (Flexo)',     quantity: 48,   unit: 'kg',    notes: 'Siegwerk brand',      createdAt: '2026-01-05T08:00:00Z' },
  { id: 'c2', category: 'Ink',    name: 'Yellow Ink (Flexo)',    quantity: 32,   unit: 'kg',    notes: 'UV-curable',          createdAt: '2026-01-05T08:00:00Z' },
  { id: 'c3', category: 'Ink',    name: 'Cyan Ink (Rotogravure)',quantity: 18,   unit: 'kg',    notes: 'Low VOC',             createdAt: '2026-02-08T08:00:00Z' },
  { id: 'c4', category: 'Ink',    name: 'Black Ink (Rotogravure)',quantity: 25,  unit: 'kg',    notes: 'Fast drying',         createdAt: '2026-02-08T08:00:00Z' },
  { id: 'c5', category: 'Thread', name: 'Polyester Thread 40s',  quantity: 120,  unit: 'bobbins', notes: 'White, heat-resist', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'c6', category: 'Thread', name: 'Nylon Thread 60s',      quantity: 85,   unit: 'bobbins', notes: 'Transparent',       createdAt: '2026-03-01T08:00:00Z' },
  { id: 'c7', category: 'Filler', name: 'CaCO₃ Masterbatch',    quantity: 350,  unit: 'kg',    notes: '60% calcium content', createdAt: '2026-01-12T08:00:00Z' },
  { id: 'c8', category: 'Filler', name: 'TiO₂ White Masterbatch',quantity: 110, unit: 'kg',    notes: '50% TiO₂ content',   createdAt: '2026-02-14T08:00:00Z' },
  { id: 'c9', category: 'Custom', name: 'Lamination Adhesive',   quantity: 65,   unit: 'litre', notes: 'Polyurethane base',   createdAt: '2026-03-20T08:00:00Z' },
  { id:'c10', category: 'Custom', name: 'Anti-Static Agent',     quantity: 22,   unit: 'litre', notes: 'Topas grade',         createdAt: '2026-04-05T08:00:00Z' },
];

// ── Orders seed ───────────────────────────────────────────────────────────────
function makeOrder(
  id: string, seq: number, client: string, type: ProductType,
  l: number, w: number, gsm: number, kg: number, nos: number,
  status: OrderStatus, dateStr: string, billNo?: string, dispDate?: string
): Order {
  const d = new Date(dateStr);
  const ymd = d.toISOString().slice(0,10).replace(/-/g,'');
  return {
    id,
    orderId: `NF-${ymd}-${String(seq).padStart(4,'0')}`,
    clientName: client,
    productType: type,
    length: l, width: w, gsm,
    sizeDisplay: `${l} × ${w} + ${gsm} gm`,
    quantityKg: kg,
    quantityNos: nos,
    quantityUnit: 'Both',
    status,
    billNo,
    dispatchDate: dispDate,
    createdAt: dateStr,
    dispatchedAt: status === 'Dispatched' ? dispDate + 'T10:00:00Z' : undefined,
  };
}

const ordersSeed: Order[] = [
  // Jan 2026
  makeOrder('o1', 1, 'Amrit Snacks Pvt Ltd',    'BOPP',      25, 30, 0.96, 450, 12000, 'Dispatched', '2026-01-05T09:00:00Z', 'BILL-001', '2026-01-18'),
  makeOrder('o2', 2, 'Surya Foods Ltd',          'Laminated', 30, 40, 1.20, 620, 8000,  'Dispatched', '2026-01-08T09:00:00Z', 'BILL-002', '2026-01-22'),
  makeOrder('o3', 3, 'National Packaging Co.',   'UL',        20, 25, 0.80, 310, 15000, 'Dispatched', '2026-01-12T09:00:00Z', 'BILL-003', '2026-01-28'),
  makeOrder('o4', 4, 'Hindustan Stores',         'Natural',   35, 45, 1.50, 180, 5000,  'Dispatched', '2026-01-20T09:00:00Z', 'BILL-004', '2026-01-30'),
  // Feb 2026
  makeOrder('o5', 1, 'Amrit Snacks Pvt Ltd',    'BOPP',      25, 30, 0.96, 520, 14000, 'Dispatched', '2026-02-03T09:00:00Z', 'BILL-005', '2026-02-15'),
  makeOrder('o6', 2, 'Reliable Exports',         'Laminated', 40, 50, 1.40, 780, 9000,  'Dispatched', '2026-02-06T09:00:00Z', 'BILL-006', '2026-02-20'),
  makeOrder('o7', 3, 'Star Polymers',            'UL',        22, 28, 0.85, 290, 12000, 'Dispatched', '2026-02-10T09:00:00Z', 'BILL-007', '2026-02-25'),
  makeOrder('o8', 4, 'Metro Retail Ltd',         'Natural',   30, 35, 1.10, 210, 6000,  'Dispatched', '2026-02-18T09:00:00Z', 'BILL-008', '2026-02-28'),
  // Mar 2026
  makeOrder('o9',  1, 'Surya Foods Ltd',         'BOPP',      25, 30, 0.96, 600, 16000, 'Dispatched', '2026-03-01T09:00:00Z', 'BILL-009', '2026-03-12'),
  makeOrder('o10', 2, 'National Packaging Co.',  'Laminated', 35, 45, 1.30, 850, 10000, 'Dispatched', '2026-03-05T09:00:00Z', 'BILL-010', '2026-03-18'),
  makeOrder('o11', 3, 'Amrit Snacks Pvt Ltd',   'UL',        20, 25, 0.80, 330, 14000, 'Dispatched', '2026-03-10T09:00:00Z', 'BILL-011', '2026-03-22'),
  makeOrder('o12', 4, 'Hindustan Stores',        'BOPP',      28, 38, 1.05, 410, 11000, 'Dispatched', '2026-03-15T09:00:00Z', 'BILL-012', '2026-03-28'),
  makeOrder('o13', 5, 'Reliable Exports',        'Natural',   32, 42, 1.20, 240, 7000,  'Dispatched', '2026-03-20T09:00:00Z', 'BILL-013', '2026-03-30'),
  // Apr 2026
  makeOrder('o14', 1, 'Metro Retail Ltd',        'BOPP',      25, 30, 0.96, 480, 13000, 'Dispatched', '2026-04-02T09:00:00Z', 'BILL-014', '2026-04-14'),
  makeOrder('o15', 2, 'Star Polymers',           'Laminated', 30, 40, 1.20, 720, 8500,  'Dispatched', '2026-04-07T09:00:00Z', 'BILL-015', '2026-04-20'),
  makeOrder('o16', 3, 'Surya Foods Ltd',         'UL',        22, 28, 0.85, 350, 15000, 'Dispatched', '2026-04-10T09:00:00Z', 'BILL-016', '2026-04-24'),
  makeOrder('o17', 4, 'National Packaging Co.',  'Natural',   35, 45, 1.50, 195, 5500,  'Dispatched', '2026-04-18T09:00:00Z', 'BILL-017', '2026-04-29'),
  // May 2026
  makeOrder('o18', 1, 'Amrit Snacks Pvt Ltd',   'BOPP',      25, 30, 0.96, 550, 15000, 'Dispatched', '2026-05-03T09:00:00Z', 'BILL-018', '2026-05-16'),
  makeOrder('o19', 2, 'Reliable Exports',        'Laminated', 40, 50, 1.40, 900, 10500, 'Dispatched', '2026-05-07T09:00:00Z', 'BILL-019', '2026-05-21'),
  makeOrder('o20', 3, 'Hindustan Stores',        'UL',        20, 25, 0.80, 280, 12000, 'Dispatched', '2026-05-12T09:00:00Z', 'BILL-020', '2026-05-26'),
  makeOrder('o21', 4, 'Metro Retail Ltd',        'BOPP',      28, 38, 1.05, 430, 11500, 'Dispatched', '2026-05-18T09:00:00Z', 'BILL-021', '2026-05-30'),
  // Jun 2026 (current month — some in-flight)
  makeOrder('o22', 1, 'Surya Foods Ltd',         'BOPP',      25, 30, 0.96, 580, 15500, 'Dispatched', '2026-06-01T09:00:00Z', 'BILL-022', '2026-06-05'),
  makeOrder('o23', 2, 'National Packaging Co.',  'Laminated', 35, 45, 1.30, 760, 9000,  'Ready',      '2026-06-02T09:00:00Z'),
  makeOrder('o24', 3, 'Star Polymers',           'UL',        22, 28, 0.85, 310, 13000, 'In Production','2026-06-03T09:00:00Z'),
  makeOrder('o25', 4, 'Amrit Snacks Pvt Ltd',   'Natural',   30, 35, 1.10, 220, 6500,  'In Production','2026-06-04T09:00:00Z'),
  makeOrder('o26', 5, 'Reliable Exports',        'BOPP',      28, 38, 1.05, 495, 12500, 'Pending',    '2026-06-04T09:00:00Z'),
];

export function seedDatabase() {
  dbSeedOnce('rolls', rollsSeed);
  dbSeedOnce('consumables', consumablesSeed);
  dbSeedOnce('orders', ordersSeed);
}
