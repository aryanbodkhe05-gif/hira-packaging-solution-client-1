// Dev-only sample data so the owner can verify features on localhost. Guarded by
// import.meta.env.DEV in main.tsx, so it never runs in the deployed build (and
// therefore never pollutes the live shared database).
import {
  factoryMachinesDb, ppGranulesDb, invRollsDb, boppFilmsDb, ordersDb,
  rawMaterialsDb, rawMaterialReceiptsDb, rateMasterDb, syncMaterialPools,
  jobCardsDb, dispatchesDb, loomEntriesDb, fabricBatchesDb, unitRollsDb,
} from './db';
import { RATE_MASTER_SEED } from '../config';
import { saveUnits, getUnits } from './units';

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

  // Two named units with fully separate data (Part 4). Names editable in Settings.
  if (getUnits().every((u) => /^Unit \d+$/.test(u.name))) {
    saveUnits([{ id: 'unit-1', name: 'Weaving Unit A' }, { id: 'unit-2', name: 'Unit 2' }]);
  }

  if (ppGranulesDb.getAll().length === 0) {
    const g = (name: string, type: string, kg: number, unitId: string) => ppGranulesDb.create({ unitId, name, type, currentStockKg: kg, bagWeightKg: 25, dateReceived: today(), createdAt: iso(), updatedAt: iso() });
    // Unit 1 stock
    g('Virgin PP Grade A', 'P.P.', 2000, 'unit-1'); g('CaCO3 Filler 80%', 'Filler', 600, 'unit-1');
    g('Reprocessed PP', 'Master Batch', 800, 'unit-1'); g('Blue Masterbatch', 'Colour', 150, 'unit-1'); g('Slip Enhancer', 'Enhancer', 120, 'unit-1');
    // Unit 2 stock (different quantities — proves separation)
    g('Virgin PP Grade B', 'P.P.', 900, 'unit-2'); g('CaCO3 Filler 70%', 'Filler', 300, 'unit-2');
  }

  // Per-unit Loom Log + P.P. Fabric entries (separate data per unit).
  if (loomEntriesDb.getAll().length === 0) {
    loomEntriesDb.create({ unitId: 'unit-1', entryId: 'LM-A-001', date: today(), shift: 'Morning', loomNo: 'Loom 1', width: 24, widthUnit: 'inches', meters: 1800, quality: 2.5, weightKg: 240, rollCount: 6, downtimeMin: 0, createdAt: iso(), updatedAt: iso() });
    loomEntriesDb.create({ unitId: 'unit-2', entryId: 'LM-B-001', date: today(), shift: 'Morning', loomNo: 'Loom 2', width: 20, widthUnit: 'inches', meters: 1200, quality: 3,   weightKg: 160, rollCount: 4, downtimeMin: 0, createdAt: iso(), updatedAt: iso() });
  }
  if (fabricBatchesDb.getAll().length === 0) {
    fabricBatchesDb.create({ unitId: 'unit-1', batchId: 'HIRA-A-001', date: today(), shift: 'Morning', line: 'Line 1', uses: [], outputMeters: 1500, status: 'Closed', createdAt: iso(), updatedAt: iso() });
    fabricBatchesDb.create({ unitId: 'unit-2', batchId: 'HIRA-B-001', date: today(), shift: 'Morning', line: 'Line 1', uses: [], outputMeters: 900,  status: 'Open',   createdAt: iso(), updatedAt: iso() });
  }

  // Roll Count: rolls sitting in Unit 1 stock, ready to transfer to Inventory (Part 5).
  if (unitRollsDb.getAll().length === 0) {
    const ur = (size: string, gm: number, nWt: number, meter: number, avg: number) =>
      unitRollsDb.create({ unitId: 'unit-1', type: 'Milky', size, gm, gWt: nWt + 2, nWt, meter, avg, status: 'in_unit', createdAt: iso() });
    ur('500mm', 12, 45, 4200, 10.5); ur('500mm', 12, 47, 4300, 10.9); ur('600mm', 14, 60, 5000, 12.0);
  }

  if (invRollsDb.getAll().length === 0) {
    // Bulk-added rolls, grouped by size+GM, each with its own weights/avg/party.
    const r = (rollNo: string, size: string, gm: number, nWt: number, meter: number, avg: number, rate: number | null, party: string) =>
      invRollsDb.create({ rollNo, type: 'Milky', size, gm, quality: 0, gWt: nWt + 2, nWt, meter, avg, rate, party, dateAdded: today() });
    // Group 500mm / 12 — bought from an outside party
    r('R-500-12-1', '500mm', 12, 48, 4200, 10.2, 128, 'Shakti Traders');
    r('R-500-12-2', '500mm', 12, 50, 4400, 10.6, 131, 'Shakti Traders');
    // Group 600mm / 14
    r('R-600-14-1', '600mm', 14, 66, 5000, 12.1, 142, 'Om Polymers');
    // Already received FROM our own unit → party auto "Hira Packaging"
    r('R-500-12-3', '500mm', 12, 45, 4100, 10.0, null, 'Hira Packaging');
    // In transit from Weaving Unit A, awaiting Receive (no roll no yet)
    invRollsDb.create({ rollNo: '', type: 'Milky', size: '500mm', gm: 12, quality: 0, gWt: 49, nWt: 47, meter: 4300, avg: 10.8, rate: null, party: 'Hira Packaging', inTransit: true, fromUnitId: 'unit-1', dateAdded: today() });
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

  // Raw materials, each ONE moving-average pool. Gravure ink deliberately has TWO
  // receipts at different rates so the blended average is visible: 100 kg @ ₹100 +
  // 400 kg @ ₹120 → 500 kg worth ₹58,000 at ₹116/kg (matches the spec example). A
  // 300 kg draw then costs 300 × ₹116 = ₹34,800, leaving 200 kg @ ₹116 = ₹23,200.
  if (rawMaterialsDb.getAll().length === 0) {
    const mat = (name: string, unit: string, receipts: { qty: number; rate: number | null; date: string; note?: string; party?: string; billNo?: string }[]) => {
      const m = rawMaterialsDb.create({ name, unit, quantity: 0, totalValue: 0, avgRate: null, unratedQty: 0, dateAdded: daysAgo(30) });
      for (const r of receipts) {
        rawMaterialReceiptsDb.create({ materialId: m.id, qty: r.qty, rate: r.rate, date: r.date, note: r.note, party: r.party, billNo: r.billNo, createdAt: iso() });
      }
    };
    // Worked example: 100 kg @ ₹100 then 400 kg @ ₹120 → average ₹116/kg. Party + Bill shown too.
    mat('Gravure ink', 'kg', [
      { qty: 100, rate: 100, date: daysAgo(20), note: 'First receipt @ ₹100', party: 'Sakshi Chemicals', billNo: 'INV-2201' },
      { qty: 400, rate: 120, date: daysAgo(4),  note: 'blends to ₹116 avg',   party: 'Sakshi Chemicals', billNo: 'INV-2288' },
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
    // Left unpriced on purpose — shows "unrated" and stays out of the average/value.
    mat('Hot melt glue', 'kg', [{ qty: 90, rate: null, date: daysAgo(6), note: 'Awaiting invoice — price later' }]);
    syncMaterialPools();
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
    // 1,000 across. JC-1 printing consumes 300 kg ink at the ₹116 average = ₹34,800.
    const now = iso();
    const emptyStage = { na: true, consumption: [], materials: [], rollUses: [] };
    const inkMat = rawMaterialsDb.getAll().find((m) => m.name === 'Gravure ink');
    // qty only — syncMaterialPools snapshots the avg rate (₹116) + cost on boot.
    const inkUse = inkMat ? [{ materialId: inkMat.id, materialName: 'Gravure ink', unit: 'kg', qty: 300, avgRate: null, cost: 0 }] : [];

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
