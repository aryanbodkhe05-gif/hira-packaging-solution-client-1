// ── Loom / P.P. production units ────────────────────────────────────────────────
// The Loom/P.P. area supports multiple independent units (default 2, extensible).
// Each unit has fully separate data (loom log, fabric, granule stock, roll count),
// partitioned by `unitId`. Unit names are editable in Settings. The active unit is
// remembered per-device; a unit-scoped Staff login is locked to its own unit.

import { getSettings, saveSettings } from './db';
import type { Unit } from '../types/models';

const UNITS_KEY = 'units_v1';                 // settings key (JSON array)
const ACTIVE_KEY = 'packflow_active_unit';    // device-local active unit

export const DEFAULT_UNITS: Unit[] = [
  { id: 'unit-1', name: 'Unit 1' },
  { id: 'unit-2', name: 'Unit 2' },
];

export function getUnits(): Unit[] {
  try {
    const raw = getSettings()[UNITS_KEY];
    const u = raw ? (JSON.parse(raw) as Unit[]) : null;
    return u && u.length ? u : DEFAULT_UNITS;
  } catch { return DEFAULT_UNITS; }
}

export function saveUnits(units: Unit[]): void {
  saveSettings({ [UNITS_KEY]: JSON.stringify(units) });
}

export function unitName(id: string | undefined): string {
  if (!id) return '—';
  return getUnits().find((u) => u.id === id)?.name ?? id;
}

// A new unit id that doesn't clash with existing ones.
export function nextUnitId(units: Unit[]): string {
  let n = units.length + 1;
  const ids = new Set(units.map((u) => u.id));
  while (ids.has(`unit-${n}`)) n += 1;
  return `unit-${n}`;
}

export function getActiveUnit(): string {
  const stored = localStorage.getItem(ACTIVE_KEY);
  const units = getUnits();
  if (stored && units.some((u) => u.id === stored)) return stored;
  return units[0].id;
}

export function setActiveUnitLS(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

// Default unit every legacy (pre-units) row is assigned to by migration.
export const PRIMARY_UNIT_ID = 'unit-1';
