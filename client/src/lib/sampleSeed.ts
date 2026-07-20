// Dev-only sample data so the owner can verify features on localhost. Guarded by
// import.meta.env.DEV in main.tsx, so it never runs in the deployed build (and
// therefore never pollutes the live shared database).
import { factoryMachinesDb, ppGranulesDb, invRollsDb, boppFilmsDb, ordersDb } from './db';

const today = () => new Date().toLocaleDateString('en-CA');
const iso = () => new Date().toISOString();

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
    // Varied size + quality so the grouping (Part I) is visible: 22/2.5, 22/3, 24/2.5
    const r = (rollNo: string, size: string, quality: number, nWt: number, meter: number) =>
      invRollsDb.create({ rollNo, type: 'Milky', size, quality, gWt: nWt + 2, nWt, meter, dateAdded: today() });
    r('R-001', '22', 2.5, 48, 4200); r('R-002', '22', 2.5, 50, 4400);
    r('R-003', '22', 3, 66, 5000); r('R-004', '24', 2.5, 52, 4300);
  }

  if (boppFilmsDb.getAll().length === 0) {
    boppFilmsDb.create({ filmNo: 'F-001', kg: 240, meter: 6000, finish: 'Glossy', micron: 20, dateAdded: today() });
    boppFilmsDb.create({ filmNo: 'F-002', kg: 180, meter: 4500, finish: 'Matte', micron: 18, dateAdded: today() });
  }

  if (ordersDb.getAll().length === 0) {
    ordersDb.create({ orderId: 'HPS-20260702-0001', brandName: 'Amrit Snacks', productType: 'BOPP', makingType: 'Bag', bagType: 'Handle', boppFilmSizes: ['520', '480'], metalizeSize: '480', linerSize: '500', linerGrm: 1.2, length: 25, width: 30, grm: 0.96, sizeDisplay: '25 × 30 + 0.96 gm', quantityNos: 12000, quantityKg: 480, quantityUnit: 'Both', status: 'Pending', createdAt: iso() });
    ordersDb.create({ orderId: 'HPS-20260702-0002', brandName: 'Surya Foods', productType: 'Plain', makingType: undefined, bagType: 'Laminated', boppFilmSizes: [], length: 18, width: 28, grm: 1.1, sizeDisplay: '18 × 28 + 1.10 gm', quantityNos: 6000, quantityKg: 220, quantityUnit: 'Both', status: 'Pending', createdAt: iso() });
  }
}
