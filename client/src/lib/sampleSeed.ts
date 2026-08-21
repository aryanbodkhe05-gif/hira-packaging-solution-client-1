// Dev-only sample data so the owner can verify features on localhost. Guarded by
// import.meta.env.DEV in main.tsx, so it never runs in the deployed build (and
// therefore never pollutes the live shared database).
import {
  factoryMachinesDb, ppGranulesDb, invRollsDb, boppFilmsDb, ordersDb,
  rawMaterialsDb, rawMaterialReceiptsDb, rateMasterDb, syncMaterialPools,
  jobCardsDb, dispatchesDb, loomEntriesDb, fabricBatchesDb, unitRollsDb, addToList,
  loomsDb, applyGranuleUses, tapeReceiptsDb,
} from './db';
import {
  RATE_MASTER_SEED, ROLL_SIZEGM_KEY, DEFAULT_ROLL_SIZEGM, ROLL_GM_KEY, DEFAULT_ROLL_GM,
} from '../config';
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

  // Two named units with fully separate data. Unit 1 (Umay) is tape-based; Unit 2 is
  // granule-based. Names editable in Settings.
  if (getUnits().every((u) => /^Unit \d+$/.test(u.name))) {
    saveUnits([{ id: 'unit-1', name: 'Umay' }, { id: 'unit-2', name: 'Unit 2' }]);
  }

  let ppU1: { id: string; name: string } | undefined;
  let fillerU1: { id: string; name: string } | undefined;
  let ppU2: { id: string; name: string } | undefined;
  let fillerU2: { id: string; name: string } | undefined;
  if (ppGranulesDb.getAll().length === 0) {
    // costPerKg = the granule's moving-average rate (drives the tape price calculator).
    const g = (name: string, type: string, kg: number, unitId: string, rate: number) => ppGranulesDb.create({ unitId, name, type, costPerKg: rate, currentStockKg: kg, bagWeightKg: 25, dateReceived: today(), createdAt: iso(), updatedAt: iso() });
    // Unit 1 stock
    ppU1 = g('Virgin PP Grade A', 'P.P.', 2000, 'unit-1', 95); fillerU1 = g('CaCO3 Filler 80%', 'Filler', 600, 'unit-1', 42);
    g('Reprocessed PP', 'Master Batch', 800, 'unit-1', 70); g('Blue Masterbatch', 'Colour', 150, 'unit-1', 180); g('Slip Enhancer', 'Enhancer', 120, 'unit-1', 150);
    // Unit 2 stock (Navkar makes its own tape — its Tape Plant consumes these).
    ppU2 = g('Virgin PP Grade B', 'P.P.', 900, 'unit-2', 98); fillerU2 = g('CaCO3 Filler 70%', 'Filler', 300, 'unit-2', 40);
  }

  // Loom machines: one loom per unit (proves per-unit isolation — Unit 1's loom must
  // NOT appear in Unit 2 and vice-versa).
  if (loomsDb.getAll().length === 0) {
    loomsDb.create({ unitId: 'unit-1', loomNo: 'Loom A1', maxRpm: 180, status: 'Active', createdAt: iso(), updatedAt: iso() });
    loomsDb.create({ unitId: 'unit-2', loomNo: 'Loom B1', maxRpm: 160, status: 'Active', createdAt: iso(), updatedAt: iso() });
  }

  // Unit 1 (Umay) buys tape — stocked by size, moving-average per size (Part 1).
  if (tapeReceiptsDb.getAll().length === 0) {
    const tr = (size: string, qty: number, rate: number | null, party: string, bill: string) =>
      tapeReceiptsDb.create({ unitId: 'unit-1', size, qty, rate, party, billNo: bill, date: daysAgo(6), createdAt: iso() });
    tr('2.5 inch', 500, 85, 'Balaji Tapes', 'BT-101');
    tr('2.5 inch', 400, 92, 'Balaji Tapes', 'BT-140');    // blends to ~₹88.11/kg avg
    tr('3 inch', 300, 78, 'Shree Tape Co', 'ST-22');
  }

  // Loom Log — both units weave from TAPE → fabric → Roll Count. Unit 1 (Umay) buys
  // its tape; Unit 2 (Navkar) makes its own in the Tape Plant (see fabric-batch seed).
  if (loomEntriesDb.getAll().length === 0) {
    // Unit 1 (Umay): 200 kg of 2.5-inch tape used, 10 kg wasted → 190 kg fabric;
    // deducts tape stock and produces roll UMY-T-001 in Roll Count.
    const tapeEntry = loomEntriesDb.create({ unitId: 'unit-1', entryId: 'LM-A-001', date: today(), shift: 'Morning', loomNo: 'Loom A1', width: 24, widthUnit: 'inches', gm: 12, meters: 1500, quality: 2.5, weightKg: 190, rollCount: 1, downtimeMin: 0, tapeSize: '2.5 inch', tapeUsedKg: 200, wastageKg: 10, fabricMadeKg: 190, tapeRate: 88.11, tapeCost: 17622, rollNo: 'UMY-T-001', rollType: 'Milky', createdAt: iso(), updatedAt: iso() });
    // Produced roll's Type + Size + GM come from the loom log (Milky, 24 inches, 12 GM), not the tape size.
    unitRollsDb.create({ unitId: 'unit-1', loomEntryId: tapeEntry.id, rollNo: 'UMY-T-001', type: 'Milky', size: '24 inches', gm: 12, gWt: 190, nWt: 190, meter: 1500, status: 'in_unit', createdAt: iso() });
    // Unit 2 (Navkar): consumes 400 kg of its OWN 2-inch tape (made in the Tape Plant,
    // sitting in the Tape Log), 10 kg wasted → 390 kg fabric; roll NAV-T-001 → Roll Count.
    const tapeEntry2 = loomEntriesDb.create({ unitId: 'unit-2', entryId: 'LM-B-001', date: today(), shift: 'Morning', loomNo: 'Loom B1', width: 20, widthUnit: 'inches', gm: 14, meters: 1200, quality: 3, weightKg: 390, rollCount: 1, downtimeMin: 0, tapeSize: '2 inch', tapeUsedKg: 400, wastageKg: 10, fabricMadeKg: 390, tapeRate: 91, tapeCost: 36400, rollNo: 'NAV-T-001', rollType: 'Natural', createdAt: iso(), updatedAt: iso() });
    // Produced roll's Type + Size + GM come from the loom log (Natural, 20 inches, 14 GM), not the tape size.
    unitRollsDb.create({ unitId: 'unit-2', loomEntryId: tapeEntry2.id, rollNo: 'NAV-T-001', type: 'Natural', size: '20 inches', gm: 14, gWt: 390, nWt: 390, meter: 1200, status: 'in_unit', createdAt: iso() });
  }
  if (fabricBatchesDb.getAll().length === 0) {
    // Unit 1 batch consumes granules → the tape price calculator prices it from
    // granule (avg) + labour/overhead. Deduct the consumed granules from stock.
    const uses = ppU1 && fillerU1
      ? [{ itemId: ppU1.id, itemName: ppU1.name, type: 'P.P.', qtyKg: 800 }, { itemId: fillerU1.id, itemName: fillerU1.name, type: 'Filler', qtyKg: 200 }]
      : [];
    if (uses.length) applyGranuleUses(uses, -1);
    fabricBatchesDb.create({ unitId: 'unit-1', batchId: 'HIRA-A-001', date: today(), shift: 'Morning', line: 'Line 1', uses, outputMeters: 1500, outputKg: 1000, status: 'Closed', createdAt: iso(), updatedAt: iso() });

    // Unit 2 (Navkar) TAPE PLANT run: consumes 1,000 kg granules → 950 kg tape, then
    // TRANSFERRED into the Tape Log as a '2 inch' lot (party Hira Packaging, rate =
    // computed cost/kg). The Unit 2 loom above consumes 400 kg of it → 550 kg remains.
    const uses2 = ppU2 && fillerU2
      ? [{ itemId: ppU2.id, itemName: ppU2.name, type: 'P.P.', qtyKg: 800 }, { itemId: fillerU2.id, itemName: fillerU2.name, type: 'Filler', qtyKg: 200 }]
      : [];
    if (uses2.length) applyGranuleUses(uses2, -1);
    const tapeKg2 = 950;
    const rate2 = Math.round((800 * 98 + 200 * 40) / tapeKg2);   // granule cost/kg ≈ ₹91
    const rec2 = tapeReceiptsDb.create({ unitId: 'unit-2', size: '2 inch', qty: tapeKg2, rate: rate2, party: 'Hira Packaging', billNo: 'TP-B-001', date: today(), createdAt: iso() });
    fabricBatchesDb.create({ unitId: 'unit-2', batchId: 'HIRA-B-001', date: today(), shift: 'Morning', line: 'Line 1', uses: uses2, outputMeters: 900, outputKg: tapeKg2, status: 'Closed', tapeLogReceiptId: rec2.id, tapeLogSize: '2 inch', tapeLogQtyKg: tapeKg2, tapeTransferredAt: iso(), createdAt: iso(), updatedAt: iso() });
  }

  // Roll Count: extra rolls sitting in Unit 1 stock (manual roll nos), ready to
  // transfer — seeded alongside the loom-produced roll above.
  if (!unitRollsDb.getAll().some((r) => r.rollNo === 'U1-A-101')) {
    const ur = (rollNo: string, size: string, gm: number, nWt: number, meter: number, avg: number) =>
      unitRollsDb.create({ unitId: 'unit-1', rollNo, type: 'Milky', size, gm, gWt: nWt + 2, nWt, meter, avg, status: 'in_unit', createdAt: iso() });
    ur('U1-A-101', '500mm', 12, 45, 4200, 10.5); ur('U1-A-102', '500mm', 12, 47, 4300, 10.9); ur('U1-A-103', '600mm', 14, 60, 5000, 12.0);
  }
  // Seed the reusable Size + GM lists so they can be picked from the type-ahead.
  ['500mm', '600mm'].forEach((s) => addToList(ROLL_SIZEGM_KEY, s, DEFAULT_ROLL_SIZEGM));
  ['12', '14'].forEach((g) => addToList(ROLL_GM_KEY, g, DEFAULT_ROLL_GM));

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
    const film = (filmNo: string, size: string, finish: 'Glossy' | 'Matte' | 'Metalized', nWt: number, meter: number, rate: number | null, party?: string) =>
      boppFilmsDb.create({ filmNo, size, finish, gWt: nWt + 3, nWt, kg: nWt, meter, rate, party, dateAdded: today() });
    // 520mm group bulk-received from one party (proves bulk add + party on films).
    film('F-520mm-1', '520mm', 'Glossy', 240, 6000, 165, 'Supreme Films');
    film('F-520mm-2', '520mm', 'Glossy', 220, 5600, 168, 'Supreme Films');
    film('F-520mm-3', '520mm', 'Matte',  180, 4500, null, 'Supreme Films');
    film('F-480mm-1', '480mm', 'Matte',  200, 5200, 172, 'Jindal Poly');
    film('F-480mm-2', '480mm', 'Metalized', 160, 4000, 188, 'Jindal Poly');
    film('F-620mm-1', '620mm', 'Glossy', 300, 7400, 162, 'Cosmo Films');
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
    // 1,000 across. JC-1 printing consumes 200 kg BOPP film → ink auto = 20 kg (10%).
    const now = iso();
    const emptyStage = { na: true, consumption: [], materials: [], rollUses: [] };
    const inkMat = rawMaterialsDb.getAll().find((m) => m.name === 'Gravure ink');
    // Printing consumes a BOPP FILM roll (200 kg of F-520mm-1); ink auto-calcs from
    // that consumed film × the sticky % (10% → 20 kg). Edit the film qty on the card
    // and the ink line re-calculates to match (Part 1). Roll shows as 520mm Glossy …
    const film520 = boppFilmsDb.getAll().find((f) => f.filmNo === 'F-520mm-1');
    const filmUse = film520 ? [{
      rollId: film520.id, rollNo: film520.filmNo, kind: 'film' as const, type: film520.finish,
      size: film520.size, gm: film520.gm, qtyKg: 200, rate: film520.rate ?? null,
      lineCost: +(200 * (film520.rate ?? 0)).toFixed(2), finished: false, balanceKg: (film520.nWt ?? 0) - 200,
    }] : [];
    // qty only — syncMaterialPools snapshots the avg rate (₹116) + cost on boot.
    const inkUse = inkMat ? [{ materialId: inkMat.id, materialName: 'Gravure ink', unit: 'kg', qty: 20, avgRate: null, cost: 0 }] : [];

    const order = ordersDb.create({ orderId: 'HPS-20260702-0003', brandName: 'Balance Demo', productType: 'BOPP', makingType: 'Bag', bagType: 'Handle', boppFilmSizes: ['520'], length: 25, width: 30, grm: 0.96, sizeDisplay: '25 × 30 + 0.96 gm', quantityNos: 12000, quantityKg: 900, quantityUnit: 'Both', status: 'In Production', createdAt: iso() });
    const jc1 = jobCardsDb.create({
      jobNo: 'HPS-2026-9001', cardType: 'BOPP', makingType: 'Bag',
      orderRef: order.id, orderNo: order.orderId, orderJobSeq: 1, client: 'Balance Demo',
      header: { brand: 'Balance Demo', qty: 12000, size: '25 × 30', finish: 'Glossy', date: today(), boppFilmSizes: ['520'] },
      printing: { na: false, consumption: [], materials: inkUse, rollUses: filmUse, inputKg: 400, rejectionKg: 20, outputKg: 380, meter: 5000, boppSize: '520mm' },
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

  // Carry-forward demo (Part 1): Printing 46 − 1 wastage → 45 carries to Slitting;
  // Slitting 45 − 1.4 wastage → 43.6 carries to Lamination (input 43.6). Metalize N/A
  // (Glossy). Every input equals the previous stage's calculated output, so no false
  // mismatch error, and balance/yield reflect the calculated 43.6.
  if (!jobCardsDb.getAll().some((c) => c.jobNo === 'HPS-2026-9003')) {
    const now = iso();
    const emptyStage = { na: true, consumption: [], materials: [], rollUses: [] };
    jobCardsDb.create({
      jobNo: 'HPS-2026-9003', cardType: 'BOPP', makingType: 'Bag', client: 'Carry Demo',
      header: { brand: 'Carry Demo', qty: 5000, size: '25 × 30', finish: 'Glossy', date: today() },
      printing: { na: false, consumption: [], materials: [], rollUses: [], inputKg: 46, rejectionKg: 1, meter: 3000 },
      metalize: { ...emptyStage },   // N/A — Glossy finish
      slitting: { na: false, consumption: [], materials: [], rollUses: [], rolls: [], inputKg: 45, rejectionKg: 1.4, outputMeter: 2900 },
      lamination: { na: false, consumption: [], materials: [], rollUses: [], rows: [{ boppInKg: 43.6 }] },
      cutting: { na: false, consumption: [], materials: [], rollUses: [], gusset: false, perforation: false, rows: [{ inputKg: 43.6, noOfBags: 5000, machine: 'Cutting-1' }] },
      dispatch: { na: false, consumption: [], materials: [], rollUses: [], lines: [{}], bagsPerBale: 100 },
      status: 'In Progress', currentStage: 'Slitting', ratesAsOf: now, createdAt: now, updatedAt: now,
    });
  }

  // Lamination Total-KG + "Sent to Cutting" + leftover-carry demo: one order, two jobs.
  //  JC-1: Total KG = 450 BOPP + 40 fabric roll + 10 LD = 500. Sent to Cutting = 400
  //        (Cutting input = 400), Balance = 100.
  //  JC-2: same order — that 100 kg is carried into its Cutting (cutting.carriedIn),
  //        so JC-1's leftover nets to 0 (deducted on carry, never double-counted).
  if (!jobCardsDb.getAll().some((c) => c.jobNo === 'HPS-2026-9004')) {
    const now = iso();
    const emptyStage = { na: true, consumption: [], materials: [], rollUses: [] };
    const fabricRoll = invRollsDb.getAll().find((r) => r.rollNo === 'R-500-12-1');
    const ldMat = rawMaterialsDb.getAll().find((m) => m.name === 'LD');
    const rollUse = fabricRoll ? [{
      rollId: fabricRoll.id, rollNo: fabricRoll.rollNo, kind: 'roll' as const, type: fabricRoll.type,
      size: fabricRoll.size, gm: fabricRoll.gm, qtyKg: 40, rate: fabricRoll.rate ?? null,
      lineCost: +(40 * (fabricRoll.rate ?? 0)).toFixed(2), finished: false, balanceKg: (fabricRoll.nWt ?? 0) - 40,
    }] : [];
    const ldUse = ldMat ? [{ materialId: ldMat.id, materialName: 'LD', unit: 'kg', qty: 10, avgRate: null, cost: 0 }] : [];

    const order = ordersDb.create({ orderId: 'HPS-20260702-0004', brandName: 'Lam Demo', productType: 'BOPP', makingType: 'Bag', bagType: 'Laminated', boppFilmSizes: ['500'], length: 25, width: 30, grm: 0.96, sizeDisplay: '25 × 30 + 0.96 gm', quantityNos: 40000, quantityKg: 900, quantityUnit: 'Both', status: 'In Production', createdAt: iso() });
    const jc1 = jobCardsDb.create({
      jobNo: 'HPS-2026-9004', cardType: 'BOPP', makingType: 'Bag',
      orderRef: order.id, orderNo: order.orderId, orderJobSeq: 1, client: 'Lam Demo',
      header: { brand: 'Lam Demo', qty: 30000, size: '25 × 30', finish: 'Glossy', date: today(), boppFilmSizes: ['500'] },
      printing: { na: false, consumption: [], materials: [], rollUses: [], inputKg: 450, meter: 6000 },
      metalize: { ...emptyStage }, slitting: { ...emptyStage, rolls: [] },
      // Total KG = 450 (BOPP row) + 40 (fabric roll) + 10 (LD) = 500. Sent 400 → Balance 100.
      lamination: { na: false, consumption: [], materials: ldUse, rollUses: rollUse, rows: [{ boppInKg: 450 }], totalMeter: 5800, sentToCuttingKg: 400 },
      cutting: { na: false, consumption: [], materials: [], rollUses: [], gusset: false, perforation: false, rows: [{ noOfBags: 30000, machine: 'Cutting-1' }] },
      dispatch: { na: false, consumption: [], materials: [], rollUses: [], lines: [{}], bagsPerBale: 100 },
      status: 'In Progress', currentStage: 'Lamination', ratesAsOf: now, createdAt: now, updatedAt: now,
    });
    jobCardsDb.create({
      jobNo: 'HPS-2026-9005', cardType: 'BOPP', makingType: 'Bag',
      orderRef: order.id, orderNo: order.orderId, orderJobSeq: 2, client: 'Lam Demo',
      header: { brand: 'Lam Demo', qty: 10000, size: '25 × 30', finish: 'Glossy', date: today(), boppFilmSizes: ['500'] },
      printing: { ...emptyStage, na: false, inputKg: 120 }, metalize: { ...emptyStage }, slitting: { ...emptyStage, rolls: [] },
      lamination: { na: false, consumption: [], materials: [], rollUses: [], rows: [{ boppInKg: 120 }] },
      // JC-1's 100 kg lamination leftover carried into this job's cutting.
      cutting: { na: false, consumption: [], materials: [], rollUses: [], gusset: false, perforation: false, rows: [{ noOfBags: 8000, machine: 'Cutting-1' }], carriedIn: [{ id: 'lamcarry-1', fromCardId: jc1.id, fromLabel: 'JC-1', pieces: 0, kg: 100, movedAt: now }] },
      dispatch: { na: false, consumption: [], materials: [], rollUses: [], lines: [{}], bagsPerBale: 100 },
      status: 'In Progress', currentStage: 'Cutting', ratesAsOf: now, createdAt: iso(), updatedAt: now,
    });
    ordersDb.update(order.id, { jobCardId: jc1.id });
  }

  // Bales + dispatch nos/kg + bill-no demo (Parts 1–4). Made 10,000 pcs / 420 kg;
  // dispatched as mixed bale groups 500×15, 400×4, 300×1 = 9,400 pcs / 376 kg
  // (weights 300 + 64 + 12); leftover ready 600 pcs / 44 kg. Bill HPB-9001 is on the
  // dispatch record AND auto-filled onto the order.
  if (!jobCardsDb.getAll().some((c) => c.jobNo === 'HPS-2026-9006')) {
    const now = iso();
    const emptyStage = { na: true, consumption: [], materials: [], rollUses: [] };
    const order = ordersDb.create({ orderId: 'HPS-20260702-0005', brandName: 'Bale Demo', productType: 'BOPP', makingType: 'Bag', bagType: 'Handle', boppFilmSizes: ['500'], length: 25, width: 30, grm: 0.96, sizeDisplay: '25 × 30 + 0.96 gm', quantityNos: 10000, quantityKg: 420, quantityUnit: 'Both', status: 'Dispatched', billNo: 'HPB-9001', createdAt: iso() });
    const jc = jobCardsDb.create({
      jobNo: 'HPS-2026-9006', cardType: 'BOPP', makingType: 'Bag',
      orderRef: order.id, orderNo: order.orderId, orderJobSeq: 1, client: 'Bale Demo',
      header: { brand: 'Bale Demo', qty: 10000, size: '25 × 30', finish: 'Glossy', date: today(), boppFilmSizes: ['500'] },
      printing: { na: false, consumption: [], materials: [], rollUses: [], inputKg: 420, meter: 5000 },
      metalize: { ...emptyStage }, slitting: { ...emptyStage, rolls: [] },
      lamination: { na: false, consumption: [], materials: [], rollUses: [], rows: [{ boppInKg: 420 }], sentToCuttingKg: 420 },
      cutting: { na: false, consumption: [], materials: [], rollUses: [], gusset: false, perforation: false, rows: [{ inputKg: 420, noOfBags: 10000, machine: 'Cutting-1' }] },
      dispatch: { na: false, consumption: [], materials: [], rollUses: [], lines: [], bales: [
        { id: 'bale-1', piecesPerBale: 500, bales: 15, weightKg: 300 },
        { id: 'bale-2', piecesPerBale: 400, bales: 4, weightKg: 64 },
        { id: 'bale-3', piecesPerBale: 300, bales: 1, weightKg: 12 },
      ] },
      status: 'Dispatched', currentStage: 'Dispatch', bagDispatchedAt: now, ratesAsOf: now, createdAt: now, updatedAt: now,
    });
    // Dispatch record mirrors the job-card dispatch: 9,400 pcs / 376 kg + bill no.
    dispatchesDb.create({ type: 'Bag', jobCardId: jc.id, jobNo: jc.jobNo, orderRef: order.id, orderNo: order.orderId, party: 'Bale Demo', brand: 'BOPP', qtyPieces: 9400, qtyKg: 376, billNo: 'HPB-9001', date: today(), createdAt: now });
    ordersDb.update(order.id, { jobCardId: jc.id });
  }
}
