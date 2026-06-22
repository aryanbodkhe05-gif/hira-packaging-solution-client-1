# Changelog

## [Unreleased] — Hira Packaging Solution upgrade

### Rebranding
- Renamed the application from **PackFlow ERP / Nico Flex Pvt Ltd** to **Hira Packaging Solution** across:
  - `client/src/config.ts` — `COMPANY.name`, `shortName`, and email domain (drives the sidebar logo, topbar, dashboard heading, etc.)
  - Browser tab title (`client/index.html`)
  - Login screen heading (`client/src/pages/LoginPage.tsx`)
  - `README.md` title, badge, and intro
  - `client/package.json` package name
- **Left unchanged (please review):** `COMPANY.owner` ("Tushar Bansal"), `gst`, `address`, and `phone` in `client/src/config.ts` still hold the old company's details — update these in one place when the real Hira Packaging values are available.

### New module — PP Fabric (Tape) Production (`/pp-fabric`)
- **Batch Entry form:** auto-generated Batch ID (`HIRA-YYYYMMDD-NNN`), date, shift, line, PP / Filler / R.P. quantities (kg), optional colour (name + qty shown only when toggled on), status, notes. Live total raw-material input and a colour-coded mix-ratio bar.
- **Wastage tracking:** linked to a batch, with wastage type, quantity, auto-calculated wastage % (qty ÷ batch input), action taken, and notes.
- **List views** for batches and wastage with search, shift/status/type filters, pagination (20/page), edit/delete, and CSV export.
- Deleting a batch cascades to its linked wastage records.

### New module — Loom Production (`/loom`)
- **Production Entry form:** auto-generated Entry ID (`LM-YYYYMMDD-NNN`), date, shift, loom selector, operator, fabric width + unit (inches/mm), meters, quality grade, weight, roll count, reed count, RPM, downtime (with conditional reason when > 0). Live **meters/kg** and **efficiency %** indicators.
- **Loom master settings** (Looms tab): add/edit/delete looms (loom no., model, max RPM capacity, install date, status), plus a configurable shift-hours value used by the efficiency calculation.
- **Efficiency %** = uptime fraction `(shift mins − downtime) / shift mins` × speed fraction `rpm / maxRpm` (speed factor applied only when both RPM and the loom's max RPM are known).
- **List view** with search + filters (loom, quality, shift, date range), pagination (20/page), edit/delete, and CSV export.

### Dashboard
- Two new summary cards: **PP Fabric — Today's Input** (kg, with today's wastage % pill) and **Loom — Meters Today**.
- **Quick Entry** panel with "New PP Batch Entry" and "New Loom Entry" buttons (deep-link to each module and open the form via `?new=1`).

### Shared / infrastructure
- `exportToCsv()` and `genDailyId()` helpers in `client/src/lib/utils.ts`.
- Reusable `Pagination` component (`client/src/components/ui/Pagination.tsx`).
- New `localStorage` tables: `fabric_batches`, `fabric_wastage`, `looms`, `loom_entries` (typed wrappers in `db.ts`).
- Every new record carries `createdAt` + `updatedAt` ("last updated") timestamps, auto-set on save.
- Demo seed data added for all four new tables.

### Notes / conventions
- Same stack and styling conventions (React + Vite + Tailwind, lucide icons, `react-hot-toast`, localStorage data layer). No framework changes.
- All new forms client-side validate with toast error messages; weight/quantity inputs are numeric with `min 0`.
- New tables use `overflow-x-auto` and forms use responsive `grid-cols-1 sm:grid-cols-*` so they work down to a 375px-wide screen.

---

## Existing bugs noticed (not fixed — listed per request)
1. **Dead/legacy code:** `client/src/pages/InventoryPage.tsx` and `LoginPage.tsx` are not routed in `App.tsx`. `InventoryPage` still imports the old axios API (`lib/api.ts`) that the live app no longer uses. `AuthContext`/`LoginPage` reference removed login behaviour.
2. **`ProductionPage` "Bags Produced" stat is mislabelled "today".** `bagsToday` sums *all* jobs' `bagsProduced`, not today's, yet the page comment calls it "today". (Same all-time-vs-today ambiguity to be aware of.)
3. **`Topbar` reads `alert.sentAt`** (`timeAgo(alert.sentAt)`) but the `AppAlert` model defines `createdAt`, not `sentAt` — alert timestamps likely render as "Invalid Date". Worth aligning the field name.
4. **`utils.ts` has stale label maps** (`ORDER_STATUS_LABELS`, `ALERT_TYPE_LABELS` reference `MACHINE_DOWN`/`SYSTEM` alert types that aren't in the current `ALERT_TYPES` config) — harmless but unused/out of sync.
5. **Unused dependencies** in `client/package.json`: `axios` and `socket.io-client` are no longer needed by the localStorage-only frontend.
