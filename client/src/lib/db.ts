// ── localStorage-based data layer ─────────────────────────────────────────────
// All data lives in localStorage under namespaced keys.
// No backend required — works offline, persists across refreshes.

import type { Roll, Consumable, Order } from '../types/models';

function getKey(table: string) { return `nicoflex_${table}`; }

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
