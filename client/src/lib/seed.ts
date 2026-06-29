import { dbSeedOnce, saveSettings, syncRollsFromProduction, STORAGE_PREFIX } from './db';
import type { Roll, Consumable, Order, Lead, Invoice, Vendor, PurchaseOrder, Machine, ProductionJob, DowntimeLog, FabricBatch, FabricWastage, Loom, LoomEntry, RateMasterItem, InvRoll, RawMaterial, BoppFilm, PPGranuleItem, Supplier, GRN } from '../types/models';
import type { User } from '../types';
import type { ProductType, OrderStatus } from '../config';
import { GST_RATE, RATE_MASTER_SEED } from '../config';

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

// ── Leads seed ────────────────────────────────────────────────────────────────
const leadsSeed: Lead[] = [
  { id: 'l1', companyName: 'Gujarat Polymers Ltd',     contactPerson: 'Ramesh Patel',   phone: '+912764001234', email: 'ramesh@gujaratpoly.com',  source: 'Trade Show',  productInterest: 'BOPP rolls',      estimatedOrderSize: 500000,  status: 'Interested',     notes: 'Met at PlastIndia 2026', lastContactedAt: '2026-05-28T10:00:00Z', createdAt: '2026-05-15T09:00:00Z', updatedAt: '2026-05-28T10:00:00Z' },
  { id: 'l2', companyName: 'Rajasthan Food Pack',       contactPerson: 'Suresh Sharma',  phone: '+917414005678', email: 'suresh@rjfoodpack.com',   source: 'Referral',    productInterest: 'Laminated film',  estimatedOrderSize: 800000,  status: 'Proposal Sent',  notes: 'Sent quote on 2 Jun',    lastContactedAt: '2026-06-02T11:00:00Z', createdAt: '2026-05-20T09:00:00Z', updatedAt: '2026-06-02T11:00:00Z' },
  { id: 'l3', companyName: 'Delhi Snacks Pvt Ltd',      contactPerson: 'Anil Gupta',     phone: '+911124009012', email: 'anil@delhisnacks.in',     source: 'Cold Call',   productInterest: 'BOPP + Natural',  estimatedOrderSize: 300000,  status: 'Contacted',      notes: 'Interested, needs sample', lastContactedAt: '2026-06-01T09:00:00Z', createdAt: '2026-05-25T09:00:00Z', updatedAt: '2026-06-01T09:00:00Z' },
  { id: 'l4', companyName: 'Punjab Agro Industries',    contactPerson: 'Harpreet Singh',  phone: '+917814003456', email: 'hp@punjabagroi.com',     source: 'Website',     productInterest: 'UL bags',         estimatedOrderSize: 1200000, status: 'Won',            notes: 'First order placed Jun', lastContactedAt: '2026-06-03T14:00:00Z', createdAt: '2026-04-10T09:00:00Z', updatedAt: '2026-06-03T14:00:00Z' },
  { id: 'l5', companyName: 'Haryana Packaging Works',   contactPerson: 'Vikas Yadav',    phone: '+916374007890', email: 'vikas@hpworks.com',      source: 'Trade Show',  productInterest: 'Laminated',       estimatedOrderSize: 650000,  status: 'New',            notes: 'Collected card at expo', lastContactedAt: undefined,           createdAt: '2026-06-03T09:00:00Z', updatedAt: '2026-06-03T09:00:00Z' },
  { id: 'l6', companyName: 'UP Confections Ltd',        contactPerson: 'Mohit Verma',    phone: '+915124001234', email: 'mohit@upconfections.in', source: 'Cold Call',   productInterest: 'BOPP',            estimatedOrderSize: 200000,  status: 'Lost',           notes: 'Went with competitor',   lastContactedAt: '2026-05-10T10:00:00Z', createdAt: '2026-04-20T09:00:00Z', updatedAt: '2026-05-10T10:00:00Z' },
  { id: 'l7', companyName: 'Maharashtra FMCG Corp',     contactPerson: 'Priya Joshi',    phone: '+912024005678', email: 'priya@mhfmcg.com',       source: 'Referral',    productInterest: 'UL + Laminated',  estimatedOrderSize: 950000,  status: 'Interested',     notes: 'Very keen, follow up',   lastContactedAt: '2026-05-30T15:00:00Z', createdAt: '2026-05-18T09:00:00Z', updatedAt: '2026-05-30T15:00:00Z' },
];

// ── Invoices seed ─────────────────────────────────────────────────────────────
function makeInvoice(
  id: string, seq: number, orderId: string, clientName: string,
  orderDetails: string, sizeDisplay: string, productType: string,
  subtotal: number, dateStr: string, dueDays: number,
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue',
  paidAt?: string, quantityKg?: number
): Invoice {
  const d = new Date(dateStr);
  const ymd = d.toISOString().slice(0,10).replace(/-/g,'');
  const gstAmt = Math.round(subtotal * GST_RATE / 100);
  const dueDate = new Date(d.getTime() + dueDays * 86400000).toISOString().slice(0,10);
  return {
    id, invoiceNumber: `INV-${ymd}-${String(seq).padStart(4,'0')}`,
    orderId, clientName, orderDetails, sizeDisplay, productType,
    subtotal, gstRate: GST_RATE, gstAmount: gstAmt,
    totalAmount: subtotal + gstAmt, dueDate,
    paidAt, paidAmount: paidAt ? subtotal + gstAmt : undefined,
    status, createdAt: dateStr, quantityKg,
  };
}

const invoicesSeed: Invoice[] = [
  makeInvoice('i1',  1, 'o1',  'Amrit Snacks Pvt Ltd',    'PKG-20260118-0001', '25 × 30 + 0.96 gm', 'BOPP',      67500, '2026-01-18T10:00:00Z', 30, 'Paid',    '2026-02-10T10:00:00Z', 450),
  makeInvoice('i2',  2, 'o2',  'Surya Foods Ltd',          'PKG-20260122-0001', '30 × 40 + 1.20 gm', 'Laminated', 93000, '2026-01-22T10:00:00Z', 30, 'Paid',    '2026-02-18T10:00:00Z', 620),
  makeInvoice('i3',  3, 'o3',  'National Packaging Co.',   'PKG-20260128-0001', '20 × 25 + 0.80 gm', 'UL',        46500, '2026-01-28T10:00:00Z', 30, 'Paid',    '2026-02-25T10:00:00Z', 310),
  makeInvoice('i4',  1, 'o5',  'Amrit Snacks Pvt Ltd',    'PKG-20260215-0001', '25 × 30 + 0.96 gm', 'BOPP',      78000, '2026-02-15T10:00:00Z', 30, 'Paid',    '2026-03-12T10:00:00Z', 520),
  makeInvoice('i5',  2, 'o6',  'Reliable Exports',         'PKG-20260220-0001', '40 × 50 + 1.40 gm', 'Laminated', 117000,'2026-02-20T10:00:00Z', 30, 'Paid',    '2026-03-18T10:00:00Z', 780),
  makeInvoice('i6',  1, 'o9',  'Surya Foods Ltd',          'PKG-20260312-0001', '25 × 30 + 0.96 gm', 'BOPP',      90000, '2026-03-12T10:00:00Z', 30, 'Paid',    '2026-04-08T10:00:00Z', 600),
  makeInvoice('i7',  2, 'o10', 'National Packaging Co.',   'PKG-20260318-0001', '35 × 45 + 1.30 gm', 'Laminated', 127500,'2026-03-18T10:00:00Z', 30, 'Paid',    '2026-04-15T10:00:00Z', 850),
  makeInvoice('i8',  1, 'o14', 'Metro Retail Ltd',         'PKG-20260414-0001', '25 × 30 + 0.96 gm', 'BOPP',      72000, '2026-04-14T10:00:00Z', 30, 'Paid',    '2026-05-10T10:00:00Z', 480),
  makeInvoice('i9',  2, 'o15', 'Star Polymers',            'PKG-20260420-0001', '30 × 40 + 1.20 gm', 'Laminated', 108000,'2026-04-20T10:00:00Z', 30, 'Sent',    undefined,              720),
  makeInvoice('i10', 1, 'o18', 'Amrit Snacks Pvt Ltd',    'PKG-20260516-0001', '25 × 30 + 0.96 gm', 'BOPP',      82500, '2026-05-16T10:00:00Z', 30, 'Sent',    undefined,              550),
  makeInvoice('i11', 2, 'o19', 'Reliable Exports',         'PKG-20260521-0001', '40 × 50 + 1.40 gm', 'Laminated', 135000,'2026-05-21T10:00:00Z', 30, 'Sent',    undefined,              900),
  makeInvoice('i12', 1, 'o22', 'Surya Foods Ltd',          'PKG-20260605-0001', '25 × 30 + 0.96 gm', 'BOPP',      87000, '2026-06-05T10:00:00Z', 30, 'Overdue', undefined,              580),
];

// ── Vendors seed ──────────────────────────────────────────────────────────────
const vendorsSeed: Vendor[] = [
  { id: 'v1', name: 'Jindal Poly Films Ltd',    contactName: 'Ravi Jindal',   phone: '+911244001234', email: 'ravi@jindalpolyfilms.com',  materialSupplied: 'BOPP Film',     rating: 4.8, paymentTerms: 'Net 30', pricePerUnit: 145, unit: 'kg',   leadTimeDays: 7,  reliability: 4.8, createdAt: '2026-01-01T09:00:00Z' },
  { id: 'v2', name: 'Cosmo Films Ltd',           contactName: 'Anita Sharma',  phone: '+912244005678', email: 'anita@cosmofilms.net',      materialSupplied: 'BOPP / UL Film',rating: 4.5, paymentTerms: 'Net 30', pricePerUnit: 138, unit: 'kg',   leadTimeDays: 10, reliability: 4.3, createdAt: '2026-01-01T09:00:00Z' },
  { id: 'v3', name: 'Uflex Ltd',                 contactName: 'Deepak Chawla', phone: '+911204009012', email: 'deepak@uflexlimited.com',   materialSupplied: 'Laminated Film',rating: 4.6, paymentTerms: 'Net 45', pricePerUnit: 162, unit: 'kg',   leadTimeDays: 8,  reliability: 4.5, createdAt: '2026-01-01T09:00:00Z' },
  { id: 'v4', name: 'Siegwerk India Pvt Ltd',    contactName: 'Priya Menon',   phone: '+912044003456', email: 'priya@siegwerk.com',        materialSupplied: 'Flexo Inks',    rating: 4.3, paymentTerms: 'Net 15', pricePerUnit: 320, unit: 'kg',   leadTimeDays: 5,  reliability: 4.2, createdAt: '2026-01-01T09:00:00Z' },
  { id: 'v5', name: 'Amar Industries',           contactName: 'Sunil Bajaj',   phone: '+911274007890', email: 'sunil@amarind.com',         materialSupplied: 'Natural Film',  rating: 3.9, paymentTerms: 'Net 30', pricePerUnit: 112, unit: 'kg',   leadTimeDays: 12, reliability: 3.8, createdAt: '2026-01-01T09:00:00Z' },
  { id: 'v6', name: 'Supreme Thread Works',      contactName: 'Govind Mishra', phone: '+915124001122', email: 'govind@supremethread.com',  materialSupplied: 'Poly Thread',   rating: 4.1, paymentTerms: 'Net 15', pricePerUnit: 450, unit: 'bobbin', leadTimeDays: 4, reliability: 4.0, createdAt: '2026-01-01T09:00:00Z' },
];

// ── Purchase Orders seed ───────────────────────────────────────────────────────
const purchaseOrdersSeed: PurchaseOrder[] = [
  { id: 'po1', poNumber: 'PO-20260510-0001', vendorId: 'v1', vendorName: 'Jindal Poly Films Ltd', material: 'BOPP Film',      quantity: 2000, unit: 'kg',     pricePerUnit: 145, totalAmount: 290000, expectedDelivery: '2026-05-20', deliveredAt: '2026-05-19', status: 'Delivered', notes: 'Regular monthly order', createdAt: '2026-05-10T09:00:00Z' },
  { id: 'po2', poNumber: 'PO-20260515-0001', vendorId: 'v3', vendorName: 'Uflex Ltd',             material: 'Laminated Film', quantity: 1500, unit: 'kg',     pricePerUnit: 162, totalAmount: 243000, expectedDelivery: '2026-05-25', deliveredAt: '2026-05-26', status: 'Delivered', notes: '',               createdAt: '2026-05-15T09:00:00Z' },
  { id: 'po3', poNumber: 'PO-20260601-0001', vendorId: 'v1', vendorName: 'Jindal Poly Films Ltd', material: 'BOPP Film',      quantity: 2500, unit: 'kg',     pricePerUnit: 145, totalAmount: 362500, expectedDelivery: '2026-06-08', deliveredAt: undefined,    status: 'Confirmed', notes: 'Urgent — low stock', createdAt: '2026-06-01T09:00:00Z' },
  { id: 'po4', poNumber: 'PO-20260602-0001', vendorId: 'v4', vendorName: 'Siegwerk India Pvt Ltd',material: 'White Ink',      quantity: 100,  unit: 'kg',     pricePerUnit: 320, totalAmount: 32000,  expectedDelivery: '2026-06-07', deliveredAt: undefined,    status: 'Sent',      notes: '',               createdAt: '2026-06-02T09:00:00Z' },
  { id: 'po5', poNumber: 'PO-20260603-0001', vendorId: 'v2', vendorName: 'Cosmo Films Ltd',       material: 'UL Film',        quantity: 1000, unit: 'kg',     pricePerUnit: 138, totalAmount: 138000, expectedDelivery: '2026-06-14', deliveredAt: undefined,    status: 'Draft',     notes: 'Awaiting approval',  createdAt: '2026-06-03T09:00:00Z' },
];

// ── Machines seed ─────────────────────────────────────────────────────────────
const machinesSeed: Machine[] = [
  { id: 'm1', name: 'Flexo Printer 6-Colour', code: 'NF-M-001', type: 'Printing',    status: 'Running',     location: 'Bay A', notes: 'Soma Flex Pro',          createdAt: '2026-01-01T08:00:00Z' },
  { id: 'm2', name: 'Roto Printer 8-Colour',  code: 'NF-M-002', type: 'Printing',    status: 'Idle',        location: 'Bay A', notes: 'Bobst rotogravure',     createdAt: '2026-01-01T08:00:00Z' },
  { id: 'm3', name: 'Bag Making Line 1',      code: 'NF-M-003', type: 'Bag Making',  status: 'Running',     location: 'Bay B', notes: 'Auto bottom-seal',      createdAt: '2026-01-01T08:00:00Z' },
  { id: 'm4', name: 'Bag Making Line 2',      code: 'NF-M-004', type: 'Bag Making',  status: 'Down',        location: 'Bay B', notes: 'Sealing head fault',    createdAt: '2026-01-01T08:00:00Z' },
  { id: 'm5', name: 'Slitter / Cutter',       code: 'NF-M-005', type: 'Cutting',     status: 'Idle',        location: 'Bay C', notes: '',                      createdAt: '2026-01-01T08:00:00Z' },
  { id: 'm6', name: 'Lamination Unit',        code: 'NF-M-006', type: 'Lamination',  status: 'Maintenance', location: 'Bay C', notes: 'Scheduled service',     createdAt: '2026-01-01T08:00:00Z' },
];

// ── Production jobs seed ──────────────────────────────────────────────────────
const productionJobsSeed: ProductionJob[] = [
  { id: 'j1', jobNo: 'JOB-20260601-0001', machineId: 'm3', machineName: 'Bag Making Line 1', rollId: 'r1',  rollNo: 'NF-R-001', bagSize: '25 × 30', bagsTarget: 12000, bagsProduced: 12000, rollFullyUsed: true,  status: 'Completed', orderRef: 'NF-20260601-0001', notes: 'Amrit Snacks run',      createdAt: '2026-06-01T09:00:00Z', completedAt: '2026-06-02T17:00:00Z' },
  { id: 'j2', jobNo: 'JOB-20260603-0001', machineId: 'm3', machineName: 'Bag Making Line 1', rollId: 'r6',  rollNo: 'NF-R-006', bagSize: '25 × 30', bagsTarget: 15500, bagsProduced: 9200,  rollFullyUsed: false, status: 'Running',   orderRef: 'NF-20260601-0001', notes: 'In progress',            createdAt: '2026-06-03T08:30:00Z' },
  { id: 'j3', jobNo: 'JOB-20260603-0002', machineId: 'm1', machineName: 'Flexo Printer 6-Colour', rollId: 'r3', rollNo: 'NF-R-003', bagSize: '35 × 45', bagsTarget: 9000, bagsProduced: 9000, rollFullyUsed: true, status: 'Completed', orderRef: 'NF-20260602-0002', notes: 'Laminated print done', createdAt: '2026-06-03T07:00:00Z', completedAt: '2026-06-03T15:30:00Z' },
  { id: 'j4', jobNo: 'JOB-20260604-0001', machineId: 'm1', machineName: 'Flexo Printer 6-Colour', rollId: 'r4', rollNo: 'NF-R-004', bagSize: '22 × 28', bagsTarget: 13000, bagsProduced: 4100, rollFullyUsed: false, status: 'Running', orderRef: 'NF-20260603-0003', notes: '', createdAt: '2026-06-04T08:00:00Z' },
  { id: 'j5', jobNo: 'JOB-20260604-0002', machineId: 'm5', machineName: 'Slitter / Cutter', rollId: 'r12', rollNo: 'NF-R-012', bagSize: '20 × 25', bagsTarget: 14000, bagsProduced: 0, rollFullyUsed: false, status: 'Queued', orderRef: 'NF-20260604-0004', notes: 'Waiting on changeover', createdAt: '2026-06-04T10:00:00Z' },
  { id: 'j6', jobNo: 'JOB-20260604-0003', machineId: 'm4', machineName: 'Bag Making Line 2', rollId: 'r8', rollNo: 'NF-R-008', bagSize: '30 × 35', bagsTarget: 6500, bagsProduced: 1200, rollFullyUsed: false, status: 'On Hold', notes: 'Machine down — sealing fault', createdAt: '2026-06-04T11:00:00Z' },
];

// ── Downtime logs seed ────────────────────────────────────────────────────────
const downtimeSeed: DowntimeLog[] = [
  { id: 'd1', machineId: 'm4', machineName: 'Bag Making Line 2', reason: 'Breakdown',         startedAt: '2026-06-04T11:15:00Z', endedAt: undefined,                notes: 'Sealing head fault — technician called', createdAt: '2026-06-04T11:15:00Z' },
  { id: 'd2', machineId: 'm6', machineName: 'Lamination Unit',   reason: 'Maintenance',       startedAt: '2026-06-04T06:00:00Z', endedAt: undefined,                notes: 'Scheduled quarterly service',           createdAt: '2026-06-04T06:00:00Z' },
  { id: 'd3', machineId: 'm3', machineName: 'Bag Making Line 1', reason: 'Changeover',        startedAt: '2026-06-03T13:00:00Z', endedAt: '2026-06-03T13:45:00Z',   notes: 'Size change 25×30 → 25×30',              createdAt: '2026-06-03T13:00:00Z' },
  { id: 'd4', machineId: 'm1', machineName: 'Flexo Printer 6-Colour', reason: 'Material Shortage', startedAt: '2026-06-02T10:30:00Z', endedAt: '2026-06-02T11:10:00Z', notes: 'White ink refill',                  createdAt: '2026-06-02T10:30:00Z' },
  { id: 'd5', machineId: 'm3', machineName: 'Bag Making Line 1', reason: 'Power Cut',         startedAt: '2026-06-01T14:00:00Z', endedAt: '2026-06-01T14:25:00Z',   notes: 'Grid outage, DG started',                createdAt: '2026-06-01T14:00:00Z' },
];

// ── PP Fabric batches seed (Module 11) ─────────────────────────────────────────
const fabricBatchesSeed: FabricBatch[] = [
  { id: 'fb1', batchId: 'HIRA-20260620-001', date: '2026-06-20', shift: 'Morning',   line: 'Line 1', outputMeters: 4200, status: 'Closed', notes: 'Standard mix',  createdAt: '2026-06-20T03:30:00Z', updatedAt: '2026-06-20T11:00:00Z',
    uses: [ { itemId: 'pg-pp1', itemName: 'Virgin PP Grade A', type: 'P.P.', qtyKg: 850 }, { itemId: 'pg-fil1', itemName: 'CaCO3 Filler 80%', type: 'Filler', qtyKg: 120 }, { itemId: 'pg-rp1', itemName: 'Reprocessed PP', type: 'RP', qtyKg: 200 }, { itemId: 'pg-col1', itemName: 'Blue Masterbatch', type: 'Colour', qtyKg: 18 } ] },
  { id: 'fb2', batchId: 'HIRA-20260620-002', date: '2026-06-20', shift: 'Afternoon', line: 'Line 2', outputMeters: 3800, status: 'Closed', notes: '',              createdAt: '2026-06-20T08:30:00Z', updatedAt: '2026-06-20T16:00:00Z',
    uses: [ { itemId: 'pg-pp1', itemName: 'Virgin PP Grade A', type: 'P.P.', qtyKg: 780 }, { itemId: 'pg-fil1', itemName: 'CaCO3 Filler 80%', type: 'Filler', qtyKg: 140 }, { itemId: 'pg-rp1', itemName: 'Reprocessed PP', type: 'RP', qtyKg: 260 } ] },
  { id: 'fb3', batchId: 'HIRA-20260621-001', date: '2026-06-21', shift: 'Morning',   line: 'Line 1', outputMeters: 4400, status: 'Closed', notes: 'Export grade',  createdAt: '2026-06-21T03:30:00Z', updatedAt: '2026-06-21T11:00:00Z',
    uses: [ { itemId: 'pg-pp1', itemName: 'Virgin PP Grade A', type: 'P.P.', qtyKg: 900 }, { itemId: 'pg-fil1', itemName: 'CaCO3 Filler 80%', type: 'Filler', qtyKg: 110 }, { itemId: 'pg-rp1', itemName: 'Reprocessed PP', type: 'RP', qtyKg: 180 }, { itemId: 'pg-col1', itemName: 'Blue Masterbatch', type: 'Colour', qtyKg: 22 } ] },
  { id: 'fb4', batchId: 'HIRA-20260622-001', date: '2026-06-22', shift: 'Morning',   line: 'Line 3', outputMeters: 3900, status: 'Open',   notes: 'In progress',  createdAt: '2026-06-22T03:30:00Z', updatedAt: '2026-06-22T03:30:00Z',
    uses: [ { itemId: 'pg-pp1', itemName: 'Virgin PP Grade A', type: 'P.P.', qtyKg: 820 }, { itemId: 'pg-fil1', itemName: 'CaCO3 Filler 80%', type: 'Filler', qtyKg: 130 }, { itemId: 'pg-rp1', itemName: 'Reprocessed PP', type: 'RP', qtyKg: 220 } ] },
];

const fabricWastageSeed: FabricWastage[] = [
  { id: 'fw1', batchRef: 'fb1', batchLabel: 'HIRA-20260620-001', type: 'Startup waste',       quantityKg: 28, action: 'Recycled back',  notes: 'Line warm-up',        createdAt: '2026-06-20T04:00:00Z', updatedAt: '2026-06-20T04:00:00Z' },
  { id: 'fw2', batchRef: 'fb1', batchLabel: 'HIRA-20260620-001', type: 'Edge trim',           quantityKg: 15, action: 'Recycled back',  notes: '',                    createdAt: '2026-06-20T10:00:00Z', updatedAt: '2026-06-20T10:00:00Z' },
  { id: 'fw3', batchRef: 'fb2', batchLabel: 'HIRA-20260620-002', type: 'Breakage',            quantityKg: 32, action: 'Sold as scrap',  notes: 'Tape snapping',       createdAt: '2026-06-20T13:00:00Z', updatedAt: '2026-06-20T13:00:00Z' },
  { id: 'fw4', batchRef: 'fb3', batchLabel: 'HIRA-20260621-001', type: 'Colour change purge', quantityKg: 24, action: 'Disposed',       notes: 'Shade changeover',    createdAt: '2026-06-21T07:00:00Z', updatedAt: '2026-06-21T07:00:00Z' },
];

// ── Looms + loom entries seed (Module 12) ──────────────────────────────────────
const loomsSeed: Loom[] = [
  { id: 'lm1', loomNo: 'Loom 1', model: 'Lohia LSL6', maxRpm: 600, installDate: '2024-03-15', status: 'Active',            createdAt: '2026-01-01T08:00:00Z', updatedAt: '2026-01-01T08:00:00Z' },
  { id: 'lm2', loomNo: 'Loom 2', model: 'Lohia LSL6', maxRpm: 600, installDate: '2024-03-15', status: 'Active',            createdAt: '2026-01-01T08:00:00Z', updatedAt: '2026-01-01T08:00:00Z' },
  { id: 'lm3', loomNo: 'Loom 3', model: 'Starlinger', maxRpm: 750, installDate: '2025-07-01', status: 'Active',            createdAt: '2026-01-01T08:00:00Z', updatedAt: '2026-01-01T08:00:00Z' },
  { id: 'lm4', loomNo: 'Loom 4', model: 'Lohia LSL4', maxRpm: 550, installDate: '2023-11-20', status: 'Under maintenance', createdAt: '2026-01-01T08:00:00Z', updatedAt: '2026-01-01T08:00:00Z' },
];

const loomEntriesSeed: LoomEntry[] = [
  { id: 'le1', entryId: 'LM-20260620-001', date: '2026-06-20', shift: 'Morning',   loomNo: 'Loom 1', operator: 'Ramesh', width: 48, widthUnit: 'inches', meters: 3200, quality: 3, weightKg: 210, rollCount: 8, reedCount: 320, rpm: 560, downtimeMin: 20, downtimeReason: 'Material shortage', notes: '', createdAt: '2026-06-20T11:00:00Z', updatedAt: '2026-06-20T11:00:00Z' },
  { id: 'le2', entryId: 'LM-20260620-002', date: '2026-06-20', shift: 'Afternoon', loomNo: 'Loom 2', operator: 'Suresh', width: 48, widthUnit: 'inches', meters: 2950, quality: 3, weightKg: 198, rollCount: 7, reedCount: 320, rpm: 540, downtimeMin: 0,  downtimeReason: '',                  notes: '', createdAt: '2026-06-20T16:00:00Z', updatedAt: '2026-06-20T16:00:00Z' },
  { id: 'le3', entryId: 'LM-20260621-001', date: '2026-06-21', shift: 'Morning',   loomNo: 'Loom 3', operator: 'Anil',   width: 60, widthUnit: 'inches', meters: 3800, quality: 2, weightKg: 245, rollCount: 9, reedCount: 360, rpm: 700, downtimeMin: 45, downtimeReason: 'Breakdown',         notes: 'Shuttle jam', createdAt: '2026-06-21T11:00:00Z', updatedAt: '2026-06-21T11:00:00Z' },
  { id: 'le4', entryId: 'LM-20260622-001', date: '2026-06-22', shift: 'Morning',   loomNo: 'Loom 1', operator: 'Ramesh', width: 48, widthUnit: 'inches', meters: 1600, quality: 2.5, weightKg: 105, rollCount: 4, reedCount: 320, rpm: 560, downtimeMin: 0,  downtimeReason: '',                  notes: 'Shift in progress', createdAt: '2026-06-22T07:00:00Z', updatedAt: '2026-06-22T07:00:00Z' },
];

// ── Rate Master seed (Module 13) ───────────────────────────────────────────────
const rateMasterSeed: RateMasterItem[] = RATE_MASTER_SEED.map((m, i) => ({
  id: `rm${i + 1}`,
  name: m.name,
  unit: m.unit,
  rate: m.rate,
  category: m.category,
  active: true,
  createdAt: '2026-01-01T08:00:00Z',
  updatedAt: '2026-01-01T08:00:00Z',
}));

// ── Inventory seed (Module 14) ──────────────────────────────────────────────────
const invRollsSeed: InvRoll[] = [
  { id: 'ir1', rollNo: 'R-001', type: 'UL',              size: '500mm', quality: 2,   gWt: 52, nWt: 50,   meter: 4200, dateAdded: '2026-06-10' },
  { id: 'ir2', rollNo: 'R-002', type: 'Natural',         size: '450mm', quality: 2.5, gWt: 48, nWt: 46,   meter: 3800, dateAdded: '2026-06-12' },
  { id: 'ir3', rollNo: 'R-003', type: 'Lamination',      size: '600mm', quality: 3,   gWt: 70, nWt: 67.5, meter: 5000, dateAdded: '2026-06-15' },
  { id: 'ir4', rollNo: 'R-004', type: 'UL Multi Colour', size: '500mm', quality: 2.5, gWt: 55, nWt: 53,   meter: 4400, dateAdded: '2026-06-18' },
];

const rawMaterialsSeed: RawMaterial[] = [
  { id: 'rm-i1', name: 'Gravure ink',   unit: 'kg',    quantity: 60,  openingQty: 60,  dateAdded: '2026-06-05' },
  { id: 'rm-i2', name: 'Thinner',       unit: 'litre', quantity: 40,  openingQty: 40,  dateAdded: '2026-06-05' },
  { id: 'rm-i3', name: 'Sewing thread', unit: 'bobbin', quantity: 120, openingQty: 120, dateAdded: '2026-06-06' },
  { id: 'rm-i4', name: 'Ethyl acetate', unit: 'kg',    quantity: 35,  openingQty: 35,  dateAdded: '2026-06-08' },
  { id: 'rm-i5', name: 'Toluene',       unit: 'kg',    quantity: 15,  openingQty: 15,  dateAdded: '2026-06-08' },
];

const ppGranulesSeed: PPGranuleItem[] = [
  { id: 'pg-pp1',  name: 'Virgin PP Grade A', type: 'P.P.',   supplier: 'Reliance Polymers', costPerKg: 95,  currentStockKg: 2000, bagWeightKg: 25, dateReceived: '2026-06-05', minStockAlert: 300, grnRef: 'GRN-20260605-001', createdAt: '2026-06-05T08:00:00Z', updatedAt: '2026-06-05T08:00:00Z' },
  { id: 'pg-fil1', name: 'CaCO3 Filler 80%',  type: 'Filler', supplier: 'Hira Masterbatch',  costPerKg: 42,  currentStockKg: 600,  bagWeightKg: 25, dateReceived: '2026-06-05', minStockAlert: 100, createdAt: '2026-06-05T08:00:00Z', updatedAt: '2026-06-05T08:00:00Z' },
  { id: 'pg-rp1',  name: 'Reprocessed PP',    type: 'RP',     supplier: 'Gokul Recyclers',   costPerKg: 55,  currentStockKg: 800,  bagWeightKg: 25, dateReceived: '2026-06-09', minStockAlert: 150, createdAt: '2026-06-09T08:00:00Z', updatedAt: '2026-06-09T08:00:00Z' },
  { id: 'pg-col1', name: 'Blue Masterbatch',  type: 'Colour', supplier: 'Hira Masterbatch',  costPerKg: 180, currentStockKg: 150,  bagWeightKg: 25, dateReceived: '2026-06-12', minStockAlert: 30,  createdAt: '2026-06-12T08:00:00Z', updatedAt: '2026-06-12T08:00:00Z' },
];

const usersSeed: User[] = [
  { id: 'u-owner',   name: 'Tushar Bansal', email: 'owner@hirapackaging.com',   role: 'OWNER',   phone: '+919876543210' },
  { id: 'u-manager', name: 'Ramesh Kumar',  email: 'manager@hirapackaging.com', role: 'MANAGER', phone: '+919876500001' },
  { id: 'u-staff',   name: 'Suresh Patel',  email: 'staff@hirapackaging.com',   role: 'STAFF',   phone: '+919876500002' },
];

const suppliersSeed: Supplier[] = [
  { id: 'sup1', name: 'Reliance Polymers',  contact: '+912266001234', gst: '27AAACR1234A1Z5', materials: 'P.P. granules, RP', createdAt: '2026-01-02T08:00:00Z' },
  { id: 'sup2', name: 'Jindal Poly Films',  contact: '+911244005678', gst: '06AAACJ5678B1Z3', materials: 'BOPP film',         createdAt: '2026-01-02T08:00:00Z' },
  { id: 'sup3', name: 'Siegwerk Inks',      contact: '+912044009012', gst: '27AAACS9012C1Z1', materials: 'Gravure ink, thinner', createdAt: '2026-01-02T08:00:00Z' },
];

const grnsSeed: GRN[] = [
  { id: 'grn1', grnNo: 'GRN-20260605-001', supplier: 'Reliance Polymers', invoiceNo: 'INV-5521', date: '2026-06-05', destination: 'P.P. Granule', itemName: 'Virgin PP Grade A (P.P.)', qty: 2000, createdAt: '2026-06-05T08:00:00Z' },
  { id: 'grn2', grnNo: 'GRN-20260609-001', supplier: 'Siegwerk Inks',     invoiceNo: 'INV-8830', date: '2026-06-09', destination: 'Raw Materials', itemName: 'Gravure ink', qty: 20, unit: 'kg', createdAt: '2026-06-09T08:00:00Z' },
];

const boppFilmsSeed: BoppFilm[] = [
  { id: 'bf1', filmNo: 'F-001', kg: 240, meter: 6000, finish: 'Glossy',    micron: 20, dateAdded: '2026-06-09' },
  { id: 'bf2', filmNo: 'F-002', kg: 180, meter: 4500, finish: 'Matte',     micron: 18, dateAdded: '2026-06-11' },
  { id: 'bf3', filmNo: 'F-003', kg: 210, meter: 5200, finish: 'Metalized', micron: 20, dateAdded: '2026-06-14' },
];

// Demo orders ready to "Send to Production" — one of each routing case.
const demoRoutingOrders: Order[] = [
  { id: 'od-bag',  orderId: 'NF-20260620-0101', clientName: 'Amrit Snacks Pvt Ltd', productType: 'BOPP',   makingType: 'Bag',  length: 25, width: 30, gsm: 0.96, sizeDisplay: '25 × 30 + 0.96 gm', quantityKg: 480, quantityNos: 12000, quantityUnit: 'Both', status: 'Pending', createdAt: '2026-06-20T09:00:00Z' },
  { id: 'od-roll', orderId: 'NF-20260620-0102', clientName: 'Star Polymers',        productType: 'BOPP',   makingType: 'Roll', length: 30, width: 0,  gsm: 0,    sizeDisplay: '600mm roll',         quantityKg: 300, quantityNos: undefined, quantityUnit: 'KG',  status: 'Pending', createdAt: '2026-06-20T09:30:00Z' },
  { id: 'od-norm', orderId: 'NF-20260620-0103', clientName: 'Hindustan Stores',     productType: 'Natural', makingType: undefined, length: 18, width: 28, gsm: 1.10, sizeDisplay: '18 × 28 + 1.10 gm', quantityKg: 220, quantityNos: 6000,  quantityUnit: 'Both', status: 'Pending', createdAt: '2026-06-20T10:00:00Z' },
];

export function seedDatabase() {
  dbSeedOnce('rolls', rollsSeed);
  dbSeedOnce('consumables', consumablesSeed);
  dbSeedOnce('orders', [...ordersSeed, ...demoRoutingOrders]);
  dbSeedOnce('leads', leadsSeed);
  dbSeedOnce('invoices', invoicesSeed);
  dbSeedOnce('vendors', vendorsSeed);
  dbSeedOnce('purchase_orders', purchaseOrdersSeed);
  dbSeedOnce('machines', machinesSeed);
  dbSeedOnce('production_jobs', productionJobsSeed);
  dbSeedOnce('downtime_logs', downtimeSeed);
  dbSeedOnce('fabric_batches', fabricBatchesSeed);
  dbSeedOnce('fabric_wastage', fabricWastageSeed);
  dbSeedOnce('looms', loomsSeed);
  dbSeedOnce('loom_entries', loomEntriesSeed);
  dbSeedOnce('rate_master', rateMasterSeed);
  dbSeedOnce('inv_rolls', invRollsSeed);
  dbSeedOnce('inv_raw_materials', rawMaterialsSeed);
  dbSeedOnce('inv_bopp_films', boppFilmsSeed);
  dbSeedOnce('inv_pp_granules', ppGranulesSeed);
  dbSeedOnce('users', usersSeed);
  dbSeedOnce('suppliers', suppliersSeed);
  dbSeedOnce('grns', grnsSeed);

  // Backfill roll status/bags from production jobs (covers pre-existing data too)
  syncRollsFromProduction();

  // Default settings (only if not already set)
  if (!localStorage.getItem(STORAGE_PREFIX + 'settings')) {
    saveSettings({
      owner_whatsapp:   '+919876543210',
      alert_whatsapp:   '+919876543210',
      followup_days:    '3',
      alert_low_stock:  'true',
      alert_overdue:    'true',
      alert_payment:    'true',
      alert_dispatch:   'true',
      alert_followup:   'true',
      alert_po_delay:   'true',
    });
  }
}
