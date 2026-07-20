// Dev-only sample data so the owner can verify features on localhost. Guarded by
// import.meta.env.DEV in main.tsx, so it never runs in the deployed build (and
// therefore never pollutes the live shared database).
import {
  factoryMachinesDb, ppGranulesDb, invRollsDb, boppFilmsDb, ordersDb,
  rawMaterialsDb, rawMaterialBatchesDb, rateMasterDb, syncBatchStock,
} from './db';
import { RATE_MASTER_SEED } from '../config';

const today = () => new Date().toLocaleDateString('en-CA');
const iso = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toLocaleDateString('en-CA');

export function seedSampleData(): void {
  if (factoryMachinesDb.getAll().length === 0) {
    (['Cutting-1', 'Cutting-2'] as const).forEach((name) => factoryMachinesDb.create({ name, type: 'Cutting/BCS', active: true, createdAt: iso() }));
    (['Loom 1', 'Loom 2'] as const).forEach((name) => factoryMachinesDb.create({ name, type: 'Loom', active: true, createdAt: iso() }));
    factoryMachinesDb.create({ name: 'Flexo-1', type: 'Flexo', active: true, createdAt: iso() });
    factoryMachinesDb.create({ name: 'Lam-1', type: 'Lamination', active: true, createdAt: iso() });
  }

  if (ppGranulesDb.getAll().length === 0) {
    const g = (name: string, type: string, kg: number) => ppGranulesDb.create({ name, type, currentStockKg: kg, bagWeightKg: 25, dateReceived: today(), createdAt: iso(), updatedAt: iso() });
    g('Virgin PP Grade A', 'P.P.', 2000); g('CaCO3 Filler 80%', 'Filler', 600);
    g('Reprocessed PP', 'Master Batch', 800); g('Blue Masterbatch', 'Colour', 150); g('Slip Enhancer', 'Enhancer', 120);
  }

  if (invRollsDb.getAll().length === 0) {
    // Each roll carries its OWN rate — consuming roll R-003 costs ₹142/kg while
    // R-001 costs ₹128/kg. R-004 is deliberately left unpriced to show the
    // "rate not set" flag and its exclusion from totals.
    const r = (rollNo: string, size: string, quality: number, nWt: number, meter: number, rate: number | null) =>
      invRollsDb.create({ rollNo, type: 'Milky', size, quality, gWt: nWt + 2, nWt, meter, rate, dateAdded: today() });
    r('R-001', '22', 2.5, 48, 4200, 128); r('R-002', '22', 2.5, 50, 4400, 131);
    r('R-003', '22', 3, 66, 5000, 142);   r('R-004', '24', 2.5, 52, 4300, null);
  }

  if (boppFilmsDb.getAll().length === 0) {
    boppFilmsDb.create({ filmNo: 'F-001', kg: 240, meter: 6000, finish: 'Glossy', micron: 20, rate: 165, dateAdded: today() });
    boppFilmsDb.create({ filmNo: 'F-002', kg: 180, meter: 4500, finish: 'Matte', micron: 18, rate: 172, dateAdded: today() });
  }

  // Raw materials, each stocked as batches. Gravure ink deliberately has TWO
  // batches at different rates so FIFO costing is visible: consumption is priced
  // at ₹300/kg until the first 200 kg runs out, then at ₹320/kg.
  if (rawMaterialsDb.getAll().length === 0) {
    const mat = (name: string, unit: string, batches: { qty: number; rate: number | null; date: string; note?: string }[]) => {
      const m = rawMaterialsDb.create({ name, unit, quantity: 0, dateAdded: daysAgo(30) });
      for (const b of batches) {
        rawMaterialBatchesDb.create({ materialId: m.id, qty: b.qty, remaining: b.qty, rate: b.rate, date: b.date, note: b.note, createdAt: iso() });
      }
    };
    mat('Gravure ink', 'kg', [
      { qty: 200, rate: 300, date: daysAgo(20), note: 'Older batch — consumed first' },
      { qty: 250, rate: 320, date: daysAgo(4),  note: 'Newer batch — higher rate' },
    ]);
    mat('Ethyl acetate', 'kg', [
      { qty: 300, rate: 95,  date: daysAgo(18) },
      { qty: 300, rate: 102, date: daysAgo(3) },
    ]);
    mat('Toluene', 'kg', [{ qty: 250, rate: 88, date: daysAgo(15) }]);
    mat('MIBK',    'kg', [{ qty: 120, rate: 145, date: daysAgo(12) }]);
    mat('IPA',     'kg', [{ qty: 180, rate: 110, date: daysAgo(10) }]);
    mat('Adhesive', 'kg', [{ qty: 150, rate: 215, date: daysAgo(14) }]);
    mat('Hardener', 'kg', [{ qty: 80,  rate: 260, date: daysAgo(14) }]);
    mat('P.P.',     'kg', [
      { qty: 500, rate: 105, date: daysAgo(21) },
      { qty: 500, rate: 112, date: daysAgo(5) },
    ]);
    mat('Filler',   'kg', [{ qty: 400, rate: 42, date: daysAgo(16) }]);
    mat('LD',       'kg', [{ qty: 300, rate: 98, date: daysAgo(16) }]);
    mat('Thread',   'kg', [{ qty: 60,  rate: 180, date: daysAgo(9) }]);
    // Left unpriced on purpose — shows "rate not set" and stays out of totals.
    mat('Hot melt glue', 'kg', [{ qty: 90, rate: null, date: daysAgo(6), note: 'Awaiting invoice — price later' }]);
    syncBatchStock();
  }

  if (rateMasterDb.getAll().length === 0) {
    for (const r of RATE_MASTER_SEED) rateMasterDb.create({ ...r, active: true, createdAt: iso(), updatedAt: iso() });
  }

  if (ordersDb.getAll().length === 0) {
    ordersDb.create({ orderId: 'HPS-20260702-0001', brandName: 'Amrit Snacks', productType: 'BOPP', makingType: 'Bag', bagType: 'Handle', boppFilmSizes: ['520', '480'], metalizeSize: '480', linerSize: '500', linerGrm: 1.2, length: 25, width: 30, grm: 0.96, sizeDisplay: '25 × 30 + 0.96 gm', quantityNos: 12000, quantityKg: 480, quantityUnit: 'Both', status: 'Pending', createdAt: iso() });
    ordersDb.create({ orderId: 'HPS-20260702-0002', brandName: 'Surya Foods', productType: 'Plain', makingType: undefined, bagType: 'Laminated', boppFilmSizes: [], length: 18, width: 28, grm: 1.1, sizeDisplay: '18 × 28 + 1.10 gm', quantityNos: 6000, quantityKg: 220, quantityUnit: 'Both', status: 'Pending', createdAt: iso() });
  }
}
