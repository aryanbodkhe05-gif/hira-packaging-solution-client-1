// ── localStorage-based data layer ─────────────────────────────────────────────
// All data lives in localStorage under namespaced keys.
// No backend required — works offline, persists across refreshes.

import type { Roll, Consumable, Order, Lead, Invoice, Vendor, PurchaseOrder, AppAlert, Machine, ProductionJob, DowntimeLog, FabricBatch, FabricWastage, Loom, LoomEntry, JobCard, RateMasterItem, DispatchRecord, InvRoll, RawMaterial, BoppFilm, FinishedRoll, FinishedFilm, PPGranuleItem, GranuleUse, Supplier, GRN } from '../types/models';
import type { User } from '../types';

// Single source of truth for the localStorage key prefix. Never hardcode the
// prefix anywhere else — always go through getKey() / STORAGE_PREFIX.
export const STORAGE_PREFIX = 'packflow_';
const LEGACY_PREFIX = 'nicoflex_';

function getKey(table: string) { return `${STORAGE_PREFIX}${table}`; }

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

function getAll<T>(table: string): T[] {
  try {
    const raw = localStorage.getItem(getKey(table));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setAll<T>(table: string, data: T[]): void {
  localStorage.setItem(getKey(table), JSON.stringify(data));
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

export const leadsDb = {
  getAll:  () => dbGetAll<Lead>('leads'),
  create:  (r: Omit<Lead, 'id'>) => dbCreate<Lead>('leads', r),
  update:  (id: string, p: Partial<Lead>) => dbUpdate<Lead>('leads', id, p),
  delete:  (id: string) => dbDelete('leads', id),
};

export const invoicesDb = {
  getAll:  () => dbGetAll<Invoice>('invoices'),
  create:  (r: Omit<Invoice, 'id'>) => dbCreate<Invoice>('invoices', r),
  update:  (id: string, p: Partial<Invoice>) => dbUpdate<Invoice>('invoices', id, p),
  delete:  (id: string) => dbDelete('invoices', id),
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
    localStorage.setItem(getKey('app_alerts'), JSON.stringify(updated));
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

export const usersDb = {
  getAll:  () => dbGetAll<User>('users'),
  create:  (r: Omit<User, 'id'>) => dbCreate<User>('users', r),
  update:  (id: string, p: Partial<User>) => dbUpdate<User>('users', id, p),
  delete:  (id: string) => dbDelete('users', id),
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

// Recompute Raw Materials remaining = openingQty − total consumed across all job
// card stage consumption rows (matched by material name). Edit-safe: always a
// full recompute from openingQty, so editing a qty re-derives stock with no drift.
// Call after any job-card save.
export function syncRawMaterialStock(): void {
  const cards = dbGetAll<JobCard>('job_cards');
  const mats = dbGetAll<RawMaterial>('inv_raw_materials');
  const consumed: Record<string, number> = {};
  const stageKeys = ['printing', 'metalize', 'slitting', 'lamination', 'cutting', 'dispatch'] as const;
  for (const c of cards) {
    for (const sk of stageKeys) {
      const stage = (c as unknown as Record<string, { consumption?: { materialName?: string; qty?: number }[] }>)[sk];
      for (const row of stage?.consumption ?? []) {
        const name = (row.materialName ?? '').trim().toLowerCase();
        if (name) consumed[name] = (consumed[name] ?? 0) + (row.qty ?? 0);
      }
    }
  }
  let changed = false;
  for (const m of mats) {
    const opening = m.openingQty ?? m.quantity;   // capture baseline on first sync
    const remaining = opening - (consumed[m.name.trim().toLowerCase()] ?? 0);
    if (m.openingQty == null || m.quantity !== remaining) {
      m.openingQty = opening;
      m.quantity = remaining;
      changed = true;
    }
  }
  if (changed) setAll('inv_raw_materials', mats);
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
  const existing = getSettings();
  localStorage.setItem(getKey('settings'), JSON.stringify({ ...existing, ...patch }));
}
