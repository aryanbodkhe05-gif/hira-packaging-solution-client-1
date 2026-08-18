// ── localStorage-based data layer ─────────────────────────────────────────────
// All data lives in localStorage under namespaced keys.
// No backend required — works offline, persists across refreshes.

import type { Roll, Consumable, Order, Vendor, PurchaseOrder, AppAlert, Machine, ProductionJob, DowntimeLog, FabricBatch, FabricWastage, Loom, LoomEntry, JobCard, RateMasterItem, DispatchRecord, InvRoll, RawMaterial, RawMaterialBatch, RawMaterialReceipt, MaterialUse, BoppFilm, FinishedRoll, FinishedFilm, PPGranuleItem, GranuleUse, Supplier, GRN, FactoryMachine, UnitRoll, TapeReceipt } from '../types/models';
import type { User } from '../types';

// Single source of truth for the localStorage key prefix. Never hardcode the
// prefix anywhere else — always go through getKey() / STORAGE_PREFIX.
export const STORAGE_PREFIX = 'packflow_';
const LEGACY_PREFIX = 'nicoflex_';

function getKey(table: string) { return `${STORAGE_PREFIX}${table}`; }

// ── Server sync (shared multi-device data) ──────────────────────────────────────
// When the backend is deployed, it is the source of truth; localStorage is a
// local mirror used for synchronous reads and offline tolerance. On boot we
// hydrate the mirror from the server (see main.tsx), and every write is pushed
// back to the server (debounced per table). If the server is unreachable the app
// falls back to local-only behaviour.
const API = '/api';
// Device-local keys that must never sync to the server.
const LOCAL_ONLY = new Set([`${STORAGE_PREFIX}session`, `${STORAGE_PREFIX}handover_purged_v1`]);

let syncEnabled = false;                 // true once a hydrate succeeds
const pushTimers: Record<string, ReturnType<typeof setTimeout>> = {};

// Push one table to the server (debounced so rapid edits coalesce).
export function pushTable(table: string, data: unknown): void {
  if (!syncEnabled) return;
  clearTimeout(pushTimers[table]);
  pushTimers[table] = setTimeout(() => {
    fetch(`${API}/data/${encodeURIComponent(table)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).catch(() => { /* best-effort; stays in localStorage */ });
  }, 350);
}

// Pull every table from the server into the local mirror. Returns false if the
// server is unreachable (the app then runs on whatever is in localStorage).
export async function hydrateFromServer(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/data`);
    if (!res.ok) return false;
    const all = await res.json() as Record<string, unknown>;
    const serverKeys = new Set(Object.keys(all));
    for (const [key, value] of Object.entries(all)) {
      localStorage.setItem(getKey(key), JSON.stringify(value));
    }
    syncEnabled = true;
    // Adopt: the first device to connect uploads any local table the server
    // doesn't have yet (e.g. the seeded login accounts on a fresh deploy).
    for (const lsKey of Object.keys(localStorage)) {
      if (!lsKey.startsWith(STORAGE_PREFIX) || LOCAL_ONLY.has(lsKey)) continue;
      const table = lsKey.slice(STORAGE_PREFIX.length);
      if (!serverKeys.has(table)) {
        try { pushTable(table, JSON.parse(localStorage.getItem(lsKey) || 'null')); } catch { /* skip */ }
      }
    }
    return true;
  } catch {
    return false;
  }
}

// One-time migration: copy any legacy `nicoflex_*` keys to `packflow_*` when the
// new key doesn't already exist, so existing data is never lost on rebrand.
// Safe to call on every load — it no-ops once migrated.
export function migrateStorage(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(LEGACY_PREFIX)) continue;
      const newKey = STORAGE_PREFIX + key.slice(LEGACY_PREFIX.length);
      if (localStorage.getItem(newKey) === null) {
        const val = localStorage.getItem(key);
        if (val !== null) localStorage.setItem(newKey, val);
      }
    }
  } catch { /* ignore quota / access errors */ }
}

// One-time handover purge: wipe ALL business/demo data from this browser but
// keep the login accounts (Users & Roles) and the current session. Runs once
// per browser, guarded by a flag, so it never touches real client data later.
export function purgeBusinessDataOnce(): void {
  const FLAG = `${STORAGE_PREFIX}handover_purged_v1`;
  const KEEP = new Set([`${STORAGE_PREFIX}auth_users`, `${STORAGE_PREFIX}session`, FLAG]);
  try {
    if (localStorage.getItem(FLAG)) return;
    for (const key of Object.keys(localStorage)) {
      if ((key.startsWith(STORAGE_PREFIX) || key.startsWith(LEGACY_PREFIX)) && !KEEP.has(key)) {
        localStorage.removeItem(key);
      }
    }
    localStorage.setItem(FLAG, new Date().toISOString());
  } catch { /* ignore quota / access errors */ }
}

// One-time rename of legacy values in stored data: UL → Milky, RP → Master Batch.
// Rewrites records, granule mixes, and the reusable dropdown lists, then pushes
// the changes to the server. Runs once (flagged).
export function migrateRenamesOnce(): void {
  const FLAG = `${STORAGE_PREFIX}renamed_ul_rp_v1`;
  try {
    if (localStorage.getItem(FLAG)) return;
    const remap = (v: string) =>
      v === 'UL' ? 'Milky' : v === 'UL Multi Colour' ? 'Milky Multi Colour'
      : (v === 'RP' || v === 'R.P.') ? 'Master Batch' : v;

    const rewriteField = (table: string, field: string) => {
      const arr = getAll<Record<string, unknown>>(table);
      let changed = false;
      for (const r of arr) {
        const v = r[field];
        if (typeof v === 'string' && remap(v) !== v) { r[field] = remap(v); changed = true; }
      }
      if (changed) setAll(table, arr);
    };
    rewriteField('rolls', 'type');
    rewriteField('inv_rolls', 'type');
    rewriteField('orders', 'productType');
    rewriteField('inv_pp_granules', 'type');

    // PP-fabric batch granule mixes
    const fb = getAll<{ uses?: { type?: string }[] }>('fabric_batches');
    let fbc = false;
    for (const b of fb) for (const u of b.uses ?? []) {
      if (u.type && remap(u.type) !== u.type) { u.type = remap(u.type); fbc = true; }
    }
    if (fbc) setAll('fabric_batches', fb);

    // Reusable dropdown lists (stored JSON strings in settings)
    const s = getSettings();
    let sc = false;
    for (const key of ['list_roll_types', 'list_granule_types']) {
      if (s[key]) {
        try {
          const list = (JSON.parse(s[key]) as string[]).map(remap);
          s[key] = JSON.stringify([...new Set(list)]);
          sc = true;
        } catch { /* skip bad json */ }
      }
    }
    if (sc) saveSettings(s);

    localStorage.setItem(FLAG, new Date().toISOString());
  } catch { /* ignore */ }
}

// One-time field rename for Part A: Order.clientName → brandName, Order.gsm → grm,
// Order.boppFilmSize (single) → boppFilmSizes (array), and the same on job-card
// headers + LaminationStage.gsm → grm. Also remaps order product types that were
// dropped from the list (Milky/Natural remain valid roll types, not order types).
export function migrateOrderFieldsOnce(): void {
  const FLAG = `${STORAGE_PREFIX}order_fields_v2`;
  try {
    if (localStorage.getItem(FLAG)) return;

    const orders = getAll<Record<string, unknown>>('orders');
    if (orders.length) {
      for (const o of orders) {
        if (o.brandName === undefined && typeof o.clientName === 'string') o.brandName = o.clientName;
        delete o.clientName;
        if (o.grm === undefined && typeof o.gsm === 'number') o.grm = o.gsm;
        delete o.gsm;
        if (!Array.isArray(o.boppFilmSizes)) {
          o.boppFilmSizes = typeof o.boppFilmSize === 'string' && o.boppFilmSize ? [o.boppFilmSize] : [];
        }
        delete o.boppFilmSize;
        // Milky/Natural are no longer order product types — nearest surviving type.
        if (o.productType === 'Milky' || o.productType === 'Natural') o.productType = 'Plain';
      }
      setAll('orders', orders);
    }

    const cards = getAll<Record<string, unknown>>('job_cards');
    if (cards.length) {
      for (const c of cards) {
        const h = c.header as Record<string, unknown> | undefined;
        if (h && !Array.isArray(h.boppFilmSizes)) {
          h.boppFilmSizes = typeof h.boppFilmSize === 'string' && h.boppFilmSize ? [h.boppFilmSize] : [];
          delete h.boppFilmSize;
        }
        const lam = c.lamination as Record<string, unknown> | undefined;
        if (lam && lam.grm === undefined && typeof lam.gsm === 'number') { lam.grm = lam.gsm; delete lam.gsm; }
      }
      setAll('job_cards', cards);
    }

    localStorage.setItem(FLAG, new Date().toISOString());
  } catch { /* ignore */ }
}

function getAll<T>(table: string): T[] {
  try {
    const raw = localStorage.getItem(getKey(table));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setAll<T>(table: string, data: T[]): void {
  localStorage.setItem(getKey(table), JSON.stringify(data));
  pushTable(table, data);
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Generic CRUD ──────────────────────────────────────────────────────────────
export function dbGetAll<T extends { id: string }>(table: string): T[] {
  return getAll<T>(table);
}

export function dbCreate<T extends { id: string }>(table: string, item: Omit<T, 'id'>): T {
  const record = { ...item, id: genId() } as T;
  const all = getAll<T>(table);
  all.unshift(record);
  setAll(table, all);
  return record;
}

// Insert a record keeping its given id (used to restore a consumed roll/film to
// stock with its original id, so consumption lines still reference it correctly).
export function dbInsertWithId<T extends { id: string }>(table: string, record: T): T {
  const all = getAll<T>(table);
  if (!all.some((r) => r.id === record.id)) { all.unshift(record); setAll(table, all); }
  return record;
}

export function dbUpdate<T extends { id: string }>(table: string, id: string, patch: Partial<T>): T | null {
  const all = getAll<T>(table);
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  setAll(table, all);
  return all[idx];
}

export function dbDelete(table: string, id: string): void {
  const all = getAll<{ id: string }>(table);
  setAll(table, all.filter((r) => r.id !== id));
}

export function dbSeedOnce(table: string, rows: unknown[]): void {
  if (!localStorage.getItem(getKey(table))) {
    setAll(table, rows);
  }
}

// ── Typed helpers ─────────────────────────────────────────────────────────────
export const rollsDb    = {
  getAll:  () => dbGetAll<Roll>('rolls'),
  create:  (r: Omit<Roll, 'id'>) => dbCreate<Roll>('rolls', r),
  update:  (id: string, p: Partial<Roll>) => dbUpdate<Roll>('rolls', id, p),
  delete:  (id: string) => dbDelete('rolls', id),
};

export const consumablesDb = {
  getAll:  () => dbGetAll<Consumable>('consumables'),
  create:  (r: Omit<Consumable, 'id'>) => dbCreate<Consumable>('consumables', r),
  update:  (id: string, p: Partial<Consumable>) => dbUpdate<Consumable>('consumables', id, p),
  delete:  (id: string) => dbDelete('consumables', id),
};

export const ordersDb = {
  getAll:  () => dbGetAll<Order>('orders'),
  create:  (r: Omit<Order, 'id'>) => dbCreate<Order>('orders', r),
  update:  (id: string, p: Partial<Order>) => dbUpdate<Order>('orders', id, p),
  delete:  (id: string) => dbDelete('orders', id),
};

export const vendorsDb = {
  getAll:  () => dbGetAll<Vendor>('vendors'),
  create:  (r: Omit<Vendor, 'id'>) => dbCreate<Vendor>('vendors', r),
  update:  (id: string, p: Partial<Vendor>) => dbUpdate<Vendor>('vendors', id, p),
  delete:  (id: string) => dbDelete('vendors', id),
};

export const purchaseOrdersDb = {
  getAll:  () => dbGetAll<PurchaseOrder>('purchase_orders'),
  create:  (r: Omit<PurchaseOrder, 'id'>) => dbCreate<PurchaseOrder>('purchase_orders', r),
  update:  (id: string, p: Partial<PurchaseOrder>) => dbUpdate<PurchaseOrder>('purchase_orders', id, p),
  delete:  (id: string) => dbDelete('purchase_orders', id),
};

export const alertsDb = {
  getAll:    () => dbGetAll<AppAlert>('app_alerts'),
  create:    (r: Omit<AppAlert, 'id'>) => dbCreate<AppAlert>('app_alerts', r),
  update:    (id: string, p: Partial<AppAlert>) => dbUpdate<AppAlert>('app_alerts', id, p),
  delete:    (id: string) => dbDelete('app_alerts', id),
  markSeen:  (id: string) => dbUpdate<AppAlert>('app_alerts', id, { seen: true }),
  markAllSeen: () => {
    const all = dbGetAll<AppAlert>('app_alerts');
    const updated = all.map((a) => ({ ...a, seen: true }));
    setAll('app_alerts', updated);
  },
};

export const machinesDb = {
  getAll:  () => dbGetAll<Machine>('machines'),
  create:  (r: Omit<Machine, 'id'>) => dbCreate<Machine>('machines', r),
  update:  (id: string, p: Partial<Machine>) => dbUpdate<Machine>('machines', id, p),
  delete:  (id: string) => dbDelete('machines', id),
};

export const productionJobsDb = {
  getAll:  () => dbGetAll<ProductionJob>('production_jobs'),
  create:  (r: Omit<ProductionJob, 'id'>) => dbCreate<ProductionJob>('production_jobs', r),
  update:  (id: string, p: Partial<ProductionJob>) => dbUpdate<ProductionJob>('production_jobs', id, p),
  delete:  (id: string) => dbDelete('production_jobs', id),
};

export const downtimeDb = {
  getAll:  () => dbGetAll<DowntimeLog>('downtime_logs'),
  create:  (r: Omit<DowntimeLog, 'id'>) => dbCreate<DowntimeLog>('downtime_logs', r),
  update:  (id: string, p: Partial<DowntimeLog>) => dbUpdate<DowntimeLog>('downtime_logs', id, p),
  delete:  (id: string) => dbDelete('downtime_logs', id),
};

// ── Module 11 — PP Fabric (Tape) Production ────────────────────────────────────
export const fabricBatchesDb = {
  getAll:  () => dbGetAll<FabricBatch>('fabric_batches'),
  create:  (r: Omit<FabricBatch, 'id'>) => dbCreate<FabricBatch>('fabric_batches', r),
  update:  (id: string, p: Partial<FabricBatch>) => dbUpdate<FabricBatch>('fabric_batches', id, p),
  delete:  (id: string) => dbDelete('fabric_batches', id),
};

export const fabricWastageDb = {
  getAll:  () => dbGetAll<FabricWastage>('fabric_wastage'),
  create:  (r: Omit<FabricWastage, 'id'>) => dbCreate<FabricWastage>('fabric_wastage', r),
  update:  (id: string, p: Partial<FabricWastage>) => dbUpdate<FabricWastage>('fabric_wastage', id, p),
  delete:  (id: string) => dbDelete('fabric_wastage', id),
};

// ── Module 12 — Loom Production ────────────────────────────────────────────────
export const loomsDb = {
  getAll:  () => dbGetAll<Loom>('looms'),
  create:  (r: Omit<Loom, 'id'>) => dbCreate<Loom>('looms', r),
  update:  (id: string, p: Partial<Loom>) => dbUpdate<Loom>('looms', id, p),
  delete:  (id: string) => dbDelete('looms', id),
};

export const loomEntriesDb = {
  getAll:  () => dbGetAll<LoomEntry>('loom_entries'),
  create:  (r: Omit<LoomEntry, 'id'>) => dbCreate<LoomEntry>('loom_entries', r),
  update:  (id: string, p: Partial<LoomEntry>) => dbUpdate<LoomEntry>('loom_entries', id, p),
  delete:  (id: string) => dbDelete('loom_entries', id),
};

// ── Module 13 — Job Card + Rate Master ─────────────────────────────────────────
export const jobCardsDb = {
  getAll:  () => dbGetAll<JobCard>('job_cards'),
  create:  (r: Omit<JobCard, 'id'>) => dbCreate<JobCard>('job_cards', r),
  update:  (id: string, p: Partial<JobCard>) => dbUpdate<JobCard>('job_cards', id, p),
  delete:  (id: string) => dbDelete('job_cards', id),
  get:     (id: string) => dbGetAll<JobCard>('job_cards').find((j) => j.id === id) ?? null,
};

export const rateMasterDb = {
  getAll:  () => dbGetAll<RateMasterItem>('rate_master'),
  create:  (r: Omit<RateMasterItem, 'id'>) => dbCreate<RateMasterItem>('rate_master', r),
  update:  (id: string, p: Partial<RateMasterItem>) => dbUpdate<RateMasterItem>('rate_master', id, p),
  delete:  (id: string) => dbDelete('rate_master', id),
};

// Finished-goods dispatch register (fed by Job Card dispatch points, tagged Roll/Bag)
export const dispatchesDb = {
  getAll:  () => dbGetAll<DispatchRecord>('dispatches'),
  create:  (r: Omit<DispatchRecord, 'id'>) => dbCreate<DispatchRecord>('dispatches', r),
  update:  (id: string, p: Partial<DispatchRecord>) => dbUpdate<DispatchRecord>('dispatches', id, p),
  delete:  (id: string) => dbDelete('dispatches', id),
};

// ── Module 14 — Inventory ──────────────────────────────────────────────────────
export const invRollsDb = {
  getAll:  () => dbGetAll<InvRoll>('inv_rolls'),
  create:  (r: Omit<InvRoll, 'id'>) => dbCreate<InvRoll>('inv_rolls', r),
  update:  (id: string, p: Partial<InvRoll>) => dbUpdate<InvRoll>('inv_rolls', id, p),
  delete:  (id: string) => dbDelete('inv_rolls', id),
};
export const rawMaterialsDb = {
  getAll:  () => dbGetAll<RawMaterial>('inv_raw_materials'),
  create:  (r: Omit<RawMaterial, 'id'>) => dbCreate<RawMaterial>('inv_raw_materials', r),
  update:  (id: string, p: Partial<RawMaterial>) => dbUpdate<RawMaterial>('inv_raw_materials', id, p),
  delete:  (id: string) => dbDelete('inv_raw_materials', id),
};
export const boppFilmsDb = {
  getAll:  () => dbGetAll<BoppFilm>('inv_bopp_films'),
  create:  (r: Omit<BoppFilm, 'id'>) => dbCreate<BoppFilm>('inv_bopp_films', r),
  update:  (id: string, p: Partial<BoppFilm>) => dbUpdate<BoppFilm>('inv_bopp_films', id, p),
  delete:  (id: string) => dbDelete('inv_bopp_films', id),
};
export const ppGranulesDb = {
  getAll:  () => dbGetAll<PPGranuleItem>('inv_pp_granules'),
  get:     (id: string) => dbGetAll<PPGranuleItem>('inv_pp_granules').find((g) => g.id === id) ?? null,
  create:  (r: Omit<PPGranuleItem, 'id'>) => dbCreate<PPGranuleItem>('inv_pp_granules', r),
  update:  (id: string, p: Partial<PPGranuleItem>) => dbUpdate<PPGranuleItem>('inv_pp_granules', id, p),
  delete:  (id: string) => dbDelete('inv_pp_granules', id),
};

// Apply (sign -1 to deduct, +1 to restore) a set of granule uses to item stock.
export function applyGranuleUses(uses: GranuleUse[], sign: 1 | -1): void {
  const items = dbGetAll<PPGranuleItem>('inv_pp_granules');
  let changed = false;
  for (const u of uses) {
    const it = items.find((x) => x.id === u.itemId);
    if (it) { it.currentStockKg = +(it.currentStockKg + sign * (u.qtyKg || 0)).toFixed(3); it.updatedAt = new Date().toISOString(); changed = true; }
  }
  if (changed) setAll('inv_pp_granules', items);
}

// Apply (sign +1) or REVERSE (sign -1) one roll/film consumption line against
// inventory — fully reversible so an edited/deleted consumption line leaves stock
// exactly as before:
//   apply  + finished → archive the roll to Finished (with its id) and drop it from stock
//   apply  + balance  → deduct the used weight, roll stays in stock
//   reverse + finished → recreate the roll in stock from its archive (original id), un-archive
//   reverse + balance  → add the used weight back
// Returns the roll's own rate on apply (for cost snapshotting).
export function applyRollUse(
  use: { rollId: string; kind: 'roll' | 'film'; qtyKg: number; finished: boolean },
  sign: 1 | -1,
  ctx: { jobNo?: string; orderNo?: string } = {},
): number | null {
  const now = new Date().toISOString();
  const round = (n: number) => +n.toFixed(3);

  if (use.kind === 'roll') {
    if (sign === 1) {
      const roll = dbGetAll<InvRoll>('inv_rolls').find((r) => r.id === use.rollId);
      if (!roll) return null;
      if (use.finished) {
        dbCreate<FinishedRoll>('inv_finished_rolls', {
          srcId: roll.id, rollNo: roll.rollNo, type: roll.type, size: roll.size, gm: roll.gm,
          quality: roll.quality, gWt: roll.gWt, nWt: roll.nWt, meter: roll.meter, avg: roll.avg,
          rate: roll.rate ?? null, party: roll.party, dateAdded: roll.dateAdded,
          consumedAt: now, jobNo: ctx.jobNo, orderNo: ctx.orderNo,
        });
        dbDelete('inv_rolls', roll.id);
      } else {
        dbUpdate<InvRoll>('inv_rolls', roll.id, { nWt: round(Math.max(0, roll.nWt - use.qtyKg)), balanceUsed: true });
      }
      return roll.rate ?? null;
    }
    // reverse
    if (use.finished) {
      const fin = [...dbGetAll<FinishedRoll>('inv_finished_rolls')].reverse().find((f) => f.srcId === use.rollId);
      if (fin) {
        dbInsertWithId<InvRoll>('inv_rolls', {
          id: fin.srcId!, rollNo: fin.rollNo, type: fin.type, size: fin.size, gm: fin.gm, quality: fin.quality,
          gWt: fin.gWt, nWt: fin.nWt, meter: fin.meter, avg: fin.avg, rate: fin.rate ?? null, party: fin.party,
          dateAdded: fin.dateAdded,
        });
        dbDelete('inv_finished_rolls', fin.id);
      }
    } else {
      const roll = dbGetAll<InvRoll>('inv_rolls').find((r) => r.id === use.rollId);
      if (roll) dbUpdate<InvRoll>('inv_rolls', roll.id, { nWt: round(roll.nWt + use.qtyKg) });
    }
    return null;
  }

  // ── film ──
  if (sign === 1) {
    const film = dbGetAll<BoppFilm>('inv_bopp_films').find((f) => f.id === use.rollId);
    if (!film) return null;
    if (use.finished) {
      dbCreate<FinishedFilm>('inv_finished_films', {
        srcId: film.id, filmNo: film.filmNo, size: film.size, gm: film.gm, kg: film.nWt ?? film.kg,
        nWt: film.nWt ?? film.kg, meter: film.meter, finish: film.finish, micron: film.micron,
        rate: film.rate ?? null, party: film.party, dateAdded: film.dateAdded,
        consumedAt: now, jobNo: ctx.jobNo, orderNo: ctx.orderNo,
      });
      dbDelete('inv_bopp_films', film.id);
    } else {
      const left = round(Math.max(0, (film.nWt ?? film.kg) - use.qtyKg));
      dbUpdate<BoppFilm>('inv_bopp_films', film.id, { nWt: left, kg: left, balanceUsed: true });
    }
    return film.rate ?? null;
  }
  // reverse film
  if (use.finished) {
    const fin = [...dbGetAll<FinishedFilm>('inv_finished_films')].reverse().find((f) => f.srcId === use.rollId);
    if (fin) {
      const w = fin.nWt ?? fin.kg;
      dbInsertWithId<BoppFilm>('inv_bopp_films', {
        id: fin.srcId!, filmNo: fin.filmNo, size: fin.size, gm: fin.gm, nWt: w, kg: w, meter: fin.meter,
        finish: fin.finish, micron: fin.micron, rate: fin.rate ?? null, party: fin.party, dateAdded: fin.dateAdded,
      });
      dbDelete('inv_finished_films', fin.id);
    }
  } else {
    const film = dbGetAll<BoppFilm>('inv_bopp_films').find((f) => f.id === use.rollId);
    if (film) { const w = round((film.nWt ?? film.kg) + use.qtyKg); dbUpdate<BoppFilm>('inv_bopp_films', film.id, { nWt: w, kg: w }); }
  }
  return null;
}

export const usersDb = {
  getAll:  () => dbGetAll<User>('users'),
  create:  (r: Omit<User, 'id'>) => dbCreate<User>('users', r),
  update:  (id: string, p: Partial<User>) => dbUpdate<User>('users', id, p),
  delete:  (id: string) => dbDelete('users', id),
};
export const factoryMachinesDb = {
  getAll:  () => dbGetAll<FactoryMachine>('factory_machines'),
  create:  (r: Omit<FactoryMachine, 'id'>) => dbCreate<FactoryMachine>('factory_machines', r),
  update:  (id: string, p: Partial<FactoryMachine>) => dbUpdate<FactoryMachine>('factory_machines', id, p),
  delete:  (id: string) => dbDelete('factory_machines', id),
};
export const suppliersDb = {
  getAll:  () => dbGetAll<Supplier>('suppliers'),
  create:  (r: Omit<Supplier, 'id'>) => dbCreate<Supplier>('suppliers', r),
  update:  (id: string, p: Partial<Supplier>) => dbUpdate<Supplier>('suppliers', id, p),
  delete:  (id: string) => dbDelete('suppliers', id),
};
export const grnsDb = {
  getAll:  () => dbGetAll<GRN>('grns'),
  create:  (r: Omit<GRN, 'id'>) => dbCreate<GRN>('grns', r),
  delete:  (id: string) => dbDelete('grns', id),
};

// Purchased tape lots (Unit 1). Stocked + moving-average costed per tape size.
export const tapeReceiptsDb = {
  getAll:  () => dbGetAll<TapeReceipt>('tape_receipts'),
  create:  (r: Omit<TapeReceipt, 'id'>) => dbCreate<TapeReceipt>('tape_receipts', r),
  update:  (id: string, p: Partial<TapeReceipt>) => dbUpdate<TapeReceipt>('tape_receipts', id, p),
  delete:  (id: string) => dbDelete('tape_receipts', id),
};

// Rolls made inside a Loom/P.P. unit (per-unit stock), transferred to Inventory
// Rolls via the two-step transfer → receive flow.
export const unitRollsDb = {
  getAll:  () => dbGetAll<UnitRoll>('unit_rolls'),
  create:  (r: Omit<UnitRoll, 'id'>) => dbCreate<UnitRoll>('unit_rolls', r),
  update:  (id: string, p: Partial<UnitRoll>) => dbUpdate<UnitRoll>('unit_rolls', id, p),
  delete:  (id: string) => dbDelete('unit_rolls', id),
};

// Receipt log for the moving-average pools. Every add-stock / GRN appends a
// receipt here; syncMaterialPools() derives each material's qty / value / avg rate
// from these receipts minus card consumption.
export const rawMaterialReceiptsDb = {
  getAll:  () => dbGetAll<RawMaterialReceipt>('inv_raw_material_receipts'),
  forItem: (materialId: string) => dbGetAll<RawMaterialReceipt>('inv_raw_material_receipts').filter((r) => r.materialId === materialId),
  create:  (r: Omit<RawMaterialReceipt, 'id'>) => dbCreate<RawMaterialReceipt>('inv_raw_material_receipts', r),
  update:  (id: string, p: Partial<RawMaterialReceipt>) => dbUpdate<RawMaterialReceipt>('inv_raw_material_receipts', id, p),
  delete:  (id: string) => dbDelete('inv_raw_material_receipts', id),
};

// Authoritative moving-average recompute. For each material, replays its receipts
// and every card's consumption of it in chronological order: a receipt blends into
// the running average; a consumption is charged at the current average (snapshotted
// onto the card) and leaves the average unchanged. Writes each material's pool
// (qty / value / avg rate / unrated qty) and each consumption line's avgRate / cost
// / shortfall. Edit-safe (full recompute, no drift); rated stock never goes negative.
// Call after any job-card save, receipt change, or on boot.
export function syncMaterialPools(): void {
  const receipts = dbGetAll<RawMaterialReceipt>('inv_raw_material_receipts');
  const mats = dbGetAll<RawMaterial>('inv_raw_materials');
  const cards = dbGetAll<JobCard>('job_cards');
  const stageKeys = ['printing', 'metalize', 'slitting', 'lamination', 'cutting', 'dispatch'] as const;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const money = (n: number) => Math.round(n * 100) / 100;
  const dpart = (s?: string) => (s ? s.slice(0, 10) : '');

  type Ev =
    | { kind: 'receipt'; date: string; seq: string; qty: number; rate: number | null }
    | { kind: 'consume'; date: string; seq: string; qty: number; ref: MaterialUse };
  const byMat = new Map<string, Ev[]>();
  const push = (id: string, ev: Ev) => { const l = byMat.get(id) ?? []; l.push(ev); byMat.set(id, l); };

  for (const r of receipts) {
    push(r.materialId, { kind: 'receipt', date: dpart(r.date) || dpart(r.createdAt), seq: r.createdAt || r.id, qty: round(r.qty || 0), rate: r.rate ?? null });
  }
  const ordered = [...cards].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  for (const c of ordered) {
    for (const sk of stageKeys) {
      const stage = (c as unknown as Record<string, { date?: string; materials?: MaterialUse[] }>)[sk];
      const date = dpart(stage?.date) || dpart(c.header?.date) || dpart(c.createdAt);
      for (const m of stage?.materials ?? []) {
        push(m.materialId, { kind: 'consume', date, seq: c.createdAt || c.id, qty: round(m.qty || 0), ref: m });
      }
    }
  }

  const poolByMat = new Map<string, { qty: number; value: number; unrated: number }>();
  for (const [id, evs] of byMat) {
    // Same date: receipts before consumptions (stock received that day is usable);
    // otherwise ordered by receipt / card timestamp.
    evs.sort((a, b) =>
      a.date !== b.date ? (a.date < b.date ? -1 : 1)
      : a.kind !== b.kind ? (a.kind === 'receipt' ? -1 : 1)
      : (a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0));
    let qty = 0, value = 0, unrated = 0;
    for (const ev of evs) {
      if (ev.kind === 'receipt') {
        if (ev.rate != null) { qty = round(qty + ev.qty); value = money(value + ev.qty * ev.rate); }
        else unrated = round(unrated + ev.qty);
      } else {
        const avg = qty > 0 ? value / qty : null;         // consumption never changes the average
        const take = round(Math.min(ev.qty, qty));
        ev.ref.avgRate = avg != null ? money(avg) : null;
        ev.ref.cost = avg != null ? money(take * avg) : 0;
        ev.ref.shortfall = ev.qty > qty ? round(ev.qty - qty) : undefined;
        qty = round(qty - take);
        value = money(value - take * (avg ?? 0));
      }
    }
    poolByMat.set(id, { qty, value, unrated });
  }

  for (const m of mats) {
    const p = poolByMat.get(m.id) ?? { qty: 0, value: 0, unrated: 0 };
    m.quantity = +p.qty.toFixed(3);
    m.totalValue = +p.value.toFixed(2);
    m.avgRate = p.qty > 0 ? money(p.value / p.qty) : null;
    m.unratedQty = +p.unrated.toFixed(3);
  }

  setAll('inv_raw_materials', mats);
  setAll('job_cards', cards);
}

// One-time migration: FIFO discrete batches → moving-average pools. Copies each
// legacy batch into the receipt log (dropping `remaining`) and collapses each card
// material's per-batch `lines` into the moving-average shape (avgRate / cost).
// syncMaterialPools() then recomputes the authoritative pools. Guarded on data
// presence so multiple devices sharing one server never double-insert receipts.
export function migrateToMovingAvgOnce(): void {
  const FLAG = `${STORAGE_PREFIX}materials_movavg_v1`;
  try {
    if (localStorage.getItem(FLAG)) return;
    // 1. Batches → receipts (only when this data hasn't been migrated already).
    const receipts = getAll<RawMaterialReceipt>('inv_raw_material_receipts');
    const batches = getAll<RawMaterialBatch>('inv_raw_material_batches');
    if (!receipts.length && batches.length) {
      const now = new Date().toISOString();
      const seeded: RawMaterialReceipt[] = batches.map((b) => ({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        materialId: b.materialId, qty: b.qty, rate: b.rate ?? null, date: b.date,
        grnRef: b.grnRef, note: b.note, createdAt: b.createdAt || now,
      }));
      setAll('inv_raw_material_receipts', seeded);
    }
    // 2. Collapse card material `lines` (FIFO split) → { avgRate, cost }.
    //    syncMaterialPools overwrites these authoritatively, so a plain weighted
    //    average of the old lines is a safe placeholder.
    const cards = getAll<Record<string, unknown>>('job_cards');
    const stageKeys = ['printing', 'metalize', 'slitting', 'lamination', 'cutting', 'dispatch'];
    let changed = false;
    for (const c of cards) {
      for (const sk of stageKeys) {
        const stage = c[sk] as { materials?: Array<Record<string, unknown>> } | undefined;
        for (const m of stage?.materials ?? []) {
          if ('avgRate' in m) continue;   // already migrated
          const lines = (m.lines as Array<Record<string, unknown>>) ?? [];
          const take = lines.reduce((s, l) => s + (Number(l.take) || 0), 0);
          const cost = typeof m.totalCost === 'number' ? m.totalCost : lines.reduce((s, l) => s + (Number(l.cost) || 0), 0);
          m.avgRate = take > 0 ? +(cost / take).toFixed(2) : null;
          m.cost = +(+cost).toFixed(2);
          delete m.lines; delete m.totalCost;
          changed = true;
        }
      }
    }
    if (changed) setAll('job_cards', cards);
    localStorage.setItem(FLAG, new Date().toISOString());
  } catch { /* ignore */ }
}

// One-time migration: introduce Loom/P.P. units. Every existing loom entry, fabric
// batch and granule item (created before units existed) is assigned to Unit 1 so no
// data is stranded. Guarded on data presence + a flag (idempotent across devices).
export function migrateUnitsOnce(): void {
  const FLAG = `${STORAGE_PREFIX}units_v1`;
  try {
    if (localStorage.getItem(FLAG)) return;
    const stamp = (table: string) => {
      const rows = getAll<{ unitId?: string }>(table);
      let changed = false;
      for (const r of rows) { if (!r.unitId) { r.unitId = 'unit-1'; changed = true; } }
      if (changed) setAll(table, rows);
    };
    stamp('loom_entries');
    stamp('fabric_batches');
    stamp('inv_pp_granules');
    stamp('looms');
    localStorage.setItem(FLAG, new Date().toISOString());
  } catch { /* ignore */ }
}

export const finishedRollsDb = {
  getAll:  () => dbGetAll<FinishedRoll>('inv_finished_rolls'),
  create:  (r: Omit<FinishedRoll, 'id'>) => dbCreate<FinishedRoll>('inv_finished_rolls', r),
  delete:  (id: string) => dbDelete('inv_finished_rolls', id),
};
export const finishedFilmsDb = {
  getAll:  () => dbGetAll<FinishedFilm>('inv_finished_films'),
  create:  (r: Omit<FinishedFilm, 'id'>) => dbCreate<FinishedFilm>('inv_finished_films', r),
  delete:  (id: string) => dbDelete('inv_finished_films', id),
};

// ── Reusable, extensible string lists (roll types, raw-material names) ──────────
// Stored in settings so they persist and grow as users add new entries.
export function getList(key: string, defaults: string[] = []): string[] {
  try {
    const raw = getSettings()[key];
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) && arr.length ? arr : defaults;
  } catch { return defaults; }
}
export function addToList(key: string, value: string, defaults: string[] = []): string[] {
  const v = value.trim();
  const cur = getList(key, defaults);
  if (!v || cur.some((x) => x.toLowerCase() === v.toLowerCase())) return cur;
  const next = [...cur, v];
  saveSettings({ [key]: JSON.stringify(next) });
  return next;
}

// ── Roll consumption sync ──────────────────────────────────────────────────────
// Recomputes every roll's `status` + `bagsProduced` from the production jobs that
// reference it. Called after any job create/update/delete so Materials → Rolls
// always reflects production automatically.
export function syncRollsFromProduction(): void {
  const jobs = dbGetAll<ProductionJob>('production_jobs');
  const rolls = dbGetAll<Roll>('rolls');
  let changed = false;

  for (const roll of rolls) {
    const rollJobs = jobs.filter((j) => j.rollId === roll.id);
    const bags = rollJobs.reduce((sum, j) => sum + (j.bagsProduced || 0), 0);
    let status: Roll['status'] = 'In Stock';
    if (rollJobs.length > 0) {
      status = rollJobs.some((j) => j.rollFullyUsed) ? 'Fully Used' : 'In Use';
    }
    if (roll.bagsProduced !== bags || roll.status !== status) {
      roll.bagsProduced = bags;
      roll.status = status;
      changed = true;
    }
  }

  if (changed) setAll('rolls', rolls);
}

// Settings helpers
export function getSettings(): Record<string, string> {
  try {
    const raw = localStorage.getItem(getKey('settings'));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
export function saveSettings(patch: Record<string, string>): void {
  const merged = { ...getSettings(), ...patch };
  localStorage.setItem(getKey('settings'), JSON.stringify(merged));
  pushTable('settings', merged);
}
