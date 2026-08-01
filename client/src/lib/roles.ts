// ── Role-based access (UI layer) ───────────────────────────────────────────────
// These helpers drive nav filtering, route guards, and cost (₹) visibility.
// They are UI conveniences ONLY — every protected capability is also enforced
// on the backend (auth + users). The role comes from the authenticated session
// (/api/auth/me), pushed here by AuthContext, never from client-trusted storage.

import type { UserRole } from '../types';

let currentRole: UserRole | null = null;
let currentProcess: string | null = null;   // Staff process assignment (per-job scoping)

export function setCurrentRole(role: UserRole | null): void {
  currentRole = role;
}
export function setCurrentProcess(process: string | null | undefined): void {
  currentProcess = process ?? null;
}
export function getRole(): UserRole | null {
  return currentRole;
}
export function getProcess(): string | null {
  return currentProcess;
}

// ── Staff process scoping ───────────────────────────────────────────────────────
// A Staff user is tied to ONE process. `area` says which part of the app they may
// see: a single job-card stage, only the Loom page, or only the P.P. Unit pages.
// Legacy Staff with no process assigned fall back to `all` (the previous Staff
// view) so nothing breaks until they're edited.
export type StaffArea = 'jobcard' | 'loom' | 'ppunit' | 'all';
export type ScopedStageKey = 'printing' | 'metalize' | 'slitting' | 'lamination' | 'cutting' | 'dispatch';
export interface StaffScope {
  area: StaffArea;
  stageKey?: ScopedStageKey;
  method?: 'BCS' | 'Back Seal';
  process?: string;
}

export function staffScope(role: UserRole | null = currentRole, process: string | null = currentProcess): StaffScope | null {
  if (role !== 'STAFF') return null;                 // only Staff is process-scoped
  if (!process) return { area: 'all' };              // legacy unassigned Staff
  switch (process) {
    case 'Printing':    return { area: 'jobcard', stageKey: 'printing', process };
    case 'Slitting':    return { area: 'jobcard', stageKey: 'slitting', process };
    case 'Metalize':    return { area: 'jobcard', stageKey: 'metalize', process };
    case 'Lamination':  return { area: 'jobcard', stageKey: 'lamination', process };
    case 'Cutting-BCS': return { area: 'jobcard', stageKey: 'cutting', method: 'BCS', process };
    case 'Back Seal':   return { area: 'jobcard', stageKey: 'cutting', method: 'Back Seal', process };
    case 'Dispatch':    return { area: 'jobcard', stageKey: 'dispatch', process };
    case 'Loom':        return { area: 'loom', process };
    case 'P.P. Unit':   return { area: 'ppunit', process };
    default:            return { area: 'jobcard', process };  // unknown custom process → job cards
  }
}

// The path a scoped Staff user should land on / be redirected to.
export function staffHome(role: UserRole | null = currentRole, process: string | null = currentProcess): string | null {
  const s = staffScope(role, process);
  if (!s || s.area === 'all') return null;
  if (s.area === 'loom') return '/loom-unit/loom';
  if (s.area === 'ppunit') return '/loom-unit/pp-fabric';
  return '/job-card';
}

// ── Nav / route access (Staff-scoped; admins always allowed) ────────────────────
function scopedStaff(role: UserRole | null): StaffScope | null {
  const s = staffScope(role);
  return s && s.area !== 'all' ? s : null;   // null = not a scoped staffer (admin or legacy)
}
export function canAccessJobCards(role: UserRole | null = currentRole): boolean {
  const s = scopedStaff(role);
  return s ? s.area === 'jobcard' : true;
}
export function canAccessLoom(role: UserRole | null = currentRole): boolean {
  const s = scopedStaff(role);
  return s ? s.area === 'loom' : true;
}
export function canAccessPPUnit(role: UserRole | null = currentRole): boolean {
  const s = scopedStaff(role);
  return s ? s.area === 'ppunit' : true;
}
// Inventory + Dashboard/Alerts are hidden from process-scoped Staff entirely.
export function canAccessGeneral(role: UserRole | null = currentRole): boolean {
  return scopedStaff(role) == null;
}

// Everyone except Staff (Developer / Owner / Manager).
function isAdminTier(role: UserRole | null): boolean {
  return role === 'DEVELOPER' || role === 'OWNER' || role === 'MANAGER';
}

// Owner/Manager/Developer can see money; Staff cannot.
export function canViewCosts(role: UserRole | null = currentRole): boolean {
  return isAdminTier(role);
}

// Rate Master — Developer / Owner / Manager (not Staff).
export function canEditRates(role: UserRole | null = currentRole): boolean {
  return isAdminTier(role);
}

// Sales (Orders, Dispatch, CRM, Finance) — not Staff.
export function canAccessSales(role: UserRole | null = currentRole): boolean {
  return isAdminTier(role);
}

// Supplier (Suppliers, GRN) — not Staff.
export function canAccessSupplier(role: UserRole | null = currentRole): boolean {
  return isAdminTier(role);
}

// Users & Roles — Developer / Owner only.
export function canManageUsers(role: UserRole | null = currentRole): boolean {
  return role === 'DEVELOPER' || role === 'OWNER';
}

// Settings (admin) — Developer / Owner only.
export function canAccessSettings(role: UserRole | null = currentRole): boolean {
  return role === 'DEVELOPER' || role === 'OWNER';
}
