import { invRollsDb, unitRollsDb, boppFilmsDb } from './db';
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
  kind: 'inv' | 'unit' | 'film';
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
  const film = boppFilmsDb.getAll().find((f) => f.id === id);
  if (film) {
    return {
      id: film.id, kind: 'film', qrToken: film.qrToken, rollNo: film.filmNo, type: film.finish,
      size: film.size, gm: film.gm, gWt: film.gWt, nWt: film.nWt ?? film.kg, meter: film.meter,
      rate: film.rate ?? null, status: film.balanceUsed ? 'Partially used' : 'In stock', party: film.party,
    };
  }
  return null;
}

// Internal Scanner lookup: resolve a roll/film by a typed query — an exact id, a roll
// no / film no (case-insensitive), or a pasted scan URL. For the owner-facing info view
// (no QR token required). Returns the first match, rolls before films.
export function findRollScanViewByQuery(query: string): RollScanView | null {
  const q = query.trim();
  if (!q) return null;
  const fromUrl = parseRollScanUrl(q);
  if (fromUrl) return findRollScanView(fromUrl.id);
  const direct = findRollScanView(q);
  if (direct) return direct;
  const lc = q.toLowerCase();
  const inv = invRollsDb.getAll().find((r) => r.rollNo.toLowerCase() === lc);
  if (inv) return findRollScanView(inv.id);
  const unit = unitRollsDb.getAll().find((r) => (r.rollNo ?? '').toLowerCase() === lc);
  if (unit) return findRollScanView(unit.id);
  const film = boppFilmsDb.getAll().find((f) => f.filmNo.toLowerCase() === lc);
  if (film) return findRollScanView(film.id);
  return null;
}

// Extract {kind, id, token} from a scanned QR's text (a /scan/roll/:id or /scan/film/:id
// URL). Returns null for anything that isn't a roll/film scan URL.
export function parseRollScanUrl(text: string): { kind: 'roll' | 'film'; id: string; token: string } | null {
  try {
    const u = new URL(text.trim());
    const m = u.pathname.match(/\/scan\/(roll|film)\/([^/?#]+)/);
    if (!m) return null;
    return { kind: m[1] as 'roll' | 'film', id: decodeURIComponent(m[2]), token: u.searchParams.get('t') ?? '' };
  } catch {
    return null;
  }
}
