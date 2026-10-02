import { invRollsDb, unitRollsDb } from './db';
import type { InvRoll, UnitRoll } from '../types/models';

// ── Roll QR tokens (Phase 1) ──────────────────────────────────────────────────
// An unguessable token printed inside a roll's QR label. Generated client-side with
// crypto.randomUUID() (collision-negligible UUIDv4); a roll gets one when its label
// is first opened, and existing rolls are backfilled once on boot (see db.ts
// backfillRollQrTokensOnce). Uniqueness is probabilistic — there is no DB constraint
// in the localStorage store.
export function newRollQrToken(): string {
  return (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

// ── Scan-result lookup (Phase 2) ──────────────────────────────────────────────
// A scanned roll can be an Inventory roll (InvRoll) or a loom/unit roll (UnitRoll);
// those are the two stores that carry a qrToken. Normalised into one read-only view.
export interface RollScanView {
  id: string;
  kind: 'inv' | 'unit';
  qrToken?: string;
  rollNo: string;
  type?: string;
  size?: string;
  gm?: number;
  gWt?: number;
  nWt?: number;
  meter?: number;
  rate?: number | null;   // shown only behind canViewCosts()
  status: string;
  party?: string;
}

function invStatus(r: InvRoll): string {
  if (r.inTransit) return 'In transit';
  if (r.dispatched) return 'Dispatched';
  if (r.balanceUsed) return 'Partially used';
  return 'In stock';
}

// Find a roll by id across the inventory + unit stores, normalised for the scan card.
// Reads the local mirror (callers refresh it from the backend first when online).
export function findRollScanView(id: string): RollScanView | null {
  const inv = invRollsDb.getAll().find((r) => r.id === id);
  if (inv) {
    return {
      id: inv.id, kind: 'inv', qrToken: inv.qrToken, rollNo: inv.rollNo, type: inv.type,
      size: inv.size, gm: inv.gm, gWt: inv.gWt, nWt: inv.nWt, meter: inv.meter,
      rate: inv.rate ?? null, status: invStatus(inv), party: inv.party,
    };
  }
  const unit: UnitRoll | undefined = unitRollsDb.getAll().find((r) => r.id === id);
  if (unit) {
    return {
      id: unit.id, kind: 'unit', qrToken: unit.qrToken, rollNo: unit.rollNo ?? '', type: unit.type,
      size: unit.size, gm: unit.gm, gWt: unit.gWt, nWt: unit.nWt, meter: unit.meter,
      rate: unit.rate ?? null, status: unit.status === 'in_transit' ? 'In transit (unit)' : 'In unit',
    };
  }
  return null;
}

// Extract {id, token} from a scanned roll QR's text (a full /scan/roll/:id?t= URL).
// Returns null for anything that isn't a roll-scan URL.
export function parseRollScanUrl(text: string): { id: string; token: string } | null {
  try {
    const u = new URL(text.trim());
    const m = u.pathname.match(/\/scan\/roll\/([^/?#]+)/);
    if (!m) return null;
    return { id: decodeURIComponent(m[1]), token: u.searchParams.get('t') ?? '' };
  } catch {
    return null;
  }
}
