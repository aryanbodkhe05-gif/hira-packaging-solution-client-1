// ── Role-based cost visibility ─────────────────────────────────────────────────
// The app's auth is currently hardcoded to an OWNER user (see AuthContext), so
// there is no real role enforcement yet. Cost gating below is therefore UI-only.
// All cost/Rate-Master visibility funnels through canViewCosts()/canEditRates()
// so flipping to real backend roles later is a one-spot change.
//
// A demo "view as role" override (stored in settings) lets you preview the
// Staff experience — operators see quantities/balances but no ₹ figures.

import type { UserRole } from '../types';
import { getSettings, saveSettings } from './db';

const VIEW_ROLE_KEY = 'view_role';

export function getViewRole(): UserRole {
  const r = getSettings()[VIEW_ROLE_KEY];
  return r === 'MANAGER' || r === 'STAFF' || r === 'OWNER' ? r : 'OWNER';
}

export function setViewRole(role: UserRole): void {
  saveSettings({ [VIEW_ROLE_KEY]: role });
}

// Owner/Manager can see money; Staff/operators cannot.
export function canViewCosts(role: UserRole = getViewRole()): boolean {
  return role === 'OWNER' || role === 'MANAGER';
}

// Only Owner/Manager maintain the Rate Master.
export function canEditRates(role: UserRole = getViewRole()): boolean {
  return role === 'OWNER' || role === 'MANAGER';
}
