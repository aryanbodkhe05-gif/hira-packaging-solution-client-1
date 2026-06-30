// ── Role-based access (UI layer) ───────────────────────────────────────────────
// These helpers drive nav filtering, route guards, and cost (₹) visibility.
// They are UI conveniences ONLY — every protected capability is also enforced
// on the backend (auth + users). The role comes from the authenticated session
// (/api/auth/me), pushed here by AuthContext, never from client-trusted storage.

import type { UserRole } from '../types';

let currentRole: UserRole | null = null;

export function setCurrentRole(role: UserRole | null): void {
  currentRole = role;
}
export function getRole(): UserRole | null {
  return currentRole;
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
