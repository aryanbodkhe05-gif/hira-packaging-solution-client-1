// Dev-only sample data so the owner can verify features on localhost. Guarded by
// import.meta.env.DEV in main.tsx, so it never runs in the deployed build (and
// therefore never pollutes the live shared database).
import {
  factoryMachinesDb, ppGranulesDb, invRollsDb, boppFilmsDb, ordersDb,
  rawMaterialsDb, rawMaterialBatchesDb, rateMasterDb, syncBatchStock,
  jobCardsDb, dispatchesDb,
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
    // BOPP films inward like rolls — grouped by size, each film its own rate.
    // F-520-3 is left unpriced to show the "rate not set" flag on consumption.
    const film = (filmNo: string, size: string, finish: 'Glossy' | 'Matte' | 'Metalized', nWt: number, meter: number, rate: number | null) =>
      boppFilmsDb.create({ filmNo, size, finish, gWt: nWt + 3, nWt, kg: nWt, meter, rate, dateAdded: today() });
    film('F-520-1', '520mm', 'Glossy', 240, 6000, 165);
    film('F-520-2', '520mm', 'Glossy', 220, 5600, 168);
    film('F-520-3', '520mm', 'Matte',  180, 4500, null);
    film('F-480-1', '480mm', 'Matte',  200, 5200, 172);
    film('F-480-2', '480mm', 'Metalized', 160, 4000, 188);
    film('F-620-1', '620mm', 'Glossy', 300, 7400, 162);
  }

  // Raw materials, each stocked as batches. Gravure ink deliberately has TWO
  // batches at different rates so the FIFO split is visible: a 300 kg draw is
  // priced 100 kg @ ₹120 + 200 kg @ ₹140 = ₹40,000 (matches the spec example).
  if (rawMaterialsDb.getAll().length === 0) {
    const mat = (name: string, unit: string, batches: { qty: number; rate: number | null; date: string; note?: string }[]) => {
      const m = rawMaterialsDb.create({ name, unit, quantity: 0, dateAdded: daysAgo(30) });
      for (const b of batches) {
        rawMaterialBatchesDb.create({ materialId: m.id, qty: b.qty, remaining: b.qty, rate: b.rate, date: b.date, note: b.note, createdAt: iso() });
      }
    };
    // Worked example: older 100 kg @ ₹120 (smaller than the job needs) + newer
    // 300 kg @ ₹140. A 300 kg draw splits 100 @ ₹120 + 200 @ ₹140.
    mat('Gravure ink', 'kg', [
      { qty: 100, rate: 120, date: daysAgo(20), note: 'Older batch — drains first' },
      { qty: 300, rate: 140, date: daysAgo(4),  note: 'Newer batch — used after the first empties' },
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
    // FIFO demo (Part 4 spec example): 180 kg draws 100 @ ₹80 + 80 @ ₹100 = ₹16,000.
    // Older batch keeps stock, so it must drain first before the newer batch.
    mat('FIFO Demo Ink', 'kg', [
      { qty: 100, rate: 80,  date: daysAgo(15), note: 'Older batch — drains first' },
      { qty: 80,  rate: 100, date: daysAgo(3),  note: 'Newer batch — used after' },
    ]);
    syncBatchStock();
  }

  if (rateMasterDb.getAll().length === 0) {
    for (const r of RATE_MASTER_SEED) rateMasterDb.create({ ...r, active: true, createdAt: iso(), updatedAt: iso() });
  }

  if (ordersDb.getAll().length === 0) {
    ordersDb.create({ orderId: 'HPS-20260702-0001', brandName: 'Amrit Snacks', productType: 'BOPP', makingType: 'Bag', bagType: 'Handle', boppFilmSizes: ['520', '480'], metalizeSize: '480', linerSize: '500', linerGrm: 1.2, length: 25, width: 30, grm: 0.96, sizeDisplay: '25 × 30 + 0.96 gm', quantityNos: 12000, quantityKg: 480, quantityUnit: 'Both', status: 'Pending', createdAt: iso() });
    ordersDb.create({ orderId: 'HPS-20260702-0002', brandName: 'Surya Foods', productType: 'Plain', makingType: undefined, bagType: 'Laminated', boppFilmSizes: [], length: 18, width: 28, grm: 1.1, sizeDisplay: '18 × 28 + 1.10 gm', quantityNos: 6000, quantityKg: 220, quantityUnit: 'Both', status: 'Pending', createdAt: iso() });

    // Dispatch + carry-button demo (Parts 1–2): order for 12,000 bags.
    // JC-1: made 6,000 (cutting bags), dispatch line ships 5,000 → 1,000 ready.
    // JC-2: no carried balance yet — use the carry button on JC-2 to move JC-1's
    // 1,000 across. JC-1 printing also consumes 300 kg ink to show the FIFO split.
    const now = iso();
    const emptyStage = { na: true, consumption: [], materials: [], rollUses: [] };
    const inkMat = rawMaterialsDb.getAll().find((m) => m.name === 'Gravure ink');
    // qty only — syncBatchStock computes the per-batch FIFO lines on boot.
    const inkUse = inkMat ? [{ materialId: inkMat.id, materialName: 'Gravure ink', unit: 'kg', qty: 300, lines: [], totalCost: 0 }] : [];

    const order = ordersDb.create({ orderId: 'HPS-20260702-0003', brandName: 'Balance Demo', productType: 'BOPP', makingType: 'Bag', bagType: 'Handle', boppFilmSizes: ['520'], length: 25, width: 30, grm: 0.96, sizeDisplay: '25 × 30 + 0.96 gm', quantityNos: 12000, quantityKg: 900, quantityUnit: 'Both', status: 'In Production', createdAt: iso() });
    const jc1 = jobCardsDb.create({
      jobNo: 'HPS-2026-9001', cardType: 'BOPP', makingType: 'Bag',
      orderRef: order.id, orderNo: order.orderId, orderJobSeq: 1, client: 'Balance Demo',
      header: { brand: 'Balance Demo', qty: 12000, size: '25 × 30', finish: 'Glossy', date: today(), boppFilmSizes: ['520'] },
      printing: { na: false, consumption: [], materials: inkUse, rollUses: [], inputKg: 400, outputKg: 380, meter: 5000 },
      metalize: { ...emptyStage }, slitting: { ...emptyStage, rolls: [] }, lamination: { ...emptyStage, rows: [{}] },
      cutting: { na: false, consumption: [], materials: [], rollUses: [], gusset: false, perforation: false, rows: [{ inputKg: 380, noOfBags: 6000, machine: 'Cutting-1' }] },
      dispatch: { na: false, consumption: [], materials: [], rollUses: [], lines: [{ pieces: 5000, quantityKg: 380, dispatchDate: today() }], bagsPerBale: 100 },
      status: 'In Progress', currentStage: 'Cutting', ratesAsOf: now, createdAt: now, updatedAt: now,
    });
    // JC-2 — no carried balance; move JC-1's 1,000 ready via the button on JC-2.
    jobCardsDb.create({
      jobNo: 'HPS-2026-9002', cardType: 'BOPP', makingType: 'Bag',
      orderRef: order.id, orderNo: order.orderId, orderJobSeq: 2, client: 'Balance Demo',
      header: { brand: 'Balance Demo', qty: 6000, size: '25 × 30', finish: 'Glossy', date: today(), boppFilmSizes: ['520'] },
      printing: { ...emptyStage, na: false }, metalize: { ...emptyStage }, slitting: { ...emptyStage, rolls: [] }, lamination: { ...emptyStage, rows: [{}] },
      cutting: { na: false, consumption: [], materials: [], rollUses: [], gusset: false, perforation: false, rows: [{}] },
      dispatch: { na: false, consumption: [], materials: [], rollUses: [], lines: [{}], carriedIn: [], bagsPerBale: 100 },
      status: 'In Progress', currentStage: 'Printing', ratesAsOf: now, createdAt: iso(), updatedAt: now,
    });
    ordersDb.update(order.id, { jobCardId: jc1.id });
  }
}
