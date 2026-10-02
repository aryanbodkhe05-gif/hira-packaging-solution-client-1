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
