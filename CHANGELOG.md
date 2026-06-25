# Changelog

## [Unreleased] — Sales → Production → Dispatch wiring

- **Order product choice:** orders now carry `productCategory` (`BOPP Bag` | `Other Bag`); choosing `BOPP Bag` reveals a required `makingType` (`Roll Making` | `Bag Making`). Persisted on the order.
- **Send to Production:** one button on each order creates a pre-filled, linked Job Card and routes it — `BOPP Bag`+`Bag Making` → BOPP card (full flow); `BOPP Bag`+`Roll Making` → BOPP card flagged roll-only (bag stages hidden); `Other Bag` → Normal card (Printing→Cutting→Dispatch). Order flips to `In Production` and links to the card (`jobCardId`); the row button becomes "Open Job Card".
- **Job Card stage visibility by variant** via `visibleStageKeys()` — Normal hides Metalize/Slitting/Lamination; roll-only hides Lamination/Cutting.
- **Two "Send to Dispatch" points** on the Job Card: after Slitting (roll jobs) and after Cutting (bag jobs), shown by making type. Each posts a `DispatchRecord` tagged `Roll`/`Bag`, marks the job `Dispatched`, and flips the linked order to `Dispatched`.
- **Dispatch registers:** new `Dispatch – Bags` and `Dispatch – Rolls` pages (one reusable component) read the dispatch store; replace the earlier placeholders. CSV export + search + pagination.
- **Removed order-side dispatch:** the old dispatch button + modal in Orders are gone — dispatch is triggered only from the Job Card.
- `[CONFIRM]` applied: roll-only stops after Slitting; single `dispatches` store tagged by type (Roll/Bag) since dedicated registers now read it; Normal Bag default flow Printing→Cutting→Dispatch.


## [Unreleased] — Job Card (Order Traveler + Live Costing)

### New module — Job Card (`/job-card`, `/job-card/new`, `/job-card/:id`)
Replaces the paper order form + Excel re-keying loop with one live digital traveler.
- **List view:** all job cards (Job No, Brand, Size, Qty, Finish, Current Stage badge, Created, Total Cost ₹, Status) with search (brand/job no) + stage/status filters + pagination. Total Cost column hidden for Staff.
- **Single card:** replicates the Hira paper form section-by-section in floor order — **Job Description → Printing → Metalize → Slitting → Lamination → Cutting → Dispatch** — with every field/unit from the brief. Each stage is a collapsible card that can be marked **N/A** (e.g. Metalize auto-N/A unless finish = Metalized); N/A stages are excluded from carry-forward and costing.
- **Balance carry-forward:** "carry output to next stage input" button auto-fills the next active stage; a mismatch warning shows when a stage's input ≠ the previous stage's output. Each stage shows **Balance = Input − Output − Rejection** and **Yield % = Output/Input**.
- **Per-stage save:** the whole card persists on Save, so operators can fill different sections at different times.
- Variable rows: Slitting up to 3 output rolls, Lamination up to 3 rows, Cutting up to 3 rows (with Gusset/Perforation + BCS 1–4), Dispatch multiple lines.
- **Print / A4 export:** `window.print()` + `@media print` styles flatten the card to a clean bordered A4 layout (app chrome hidden).

### New module — Rate Master (`/rate-master`, owner/manager only)
- Editable list of raw materials (name, unit, rate ₹, stage/category, active, last-updated) with add/edit/delete; seeded with the 18 items from the brief. Hidden from the sidebar and route-guarded for Staff.

### Live costing engine
- Per-stage **consumption editors** are data-driven from the Rate Master (materials of that stage's category, plus 'Any'). Typing a quantity shows **line cost = qty × rate** live, no save needed.
- **Sticky summary panel:** per-stage cost, **Total Job Cost**, **cost/bag**, **cost/kg**, **total wastage (rejection + trim)**, **overall yield %** — all recompute live. ₹ uses Indian grouping (e.g. ₹50,353.00).
- **Rate snapshotting:** the rate is captured onto the job card when a quantity is entered, so later Rate Master edits don't change historical costs ("rates as of <date>"). Metalize doesn't re-cost BOPP film (booked in Printing).
- **Rate-not-set handling:** a material with no rate shows "rate not set" and is excluded from totals with a visible flag (never silently 0).

### Roles & cost visibility (UI-only for now)
- All cost / Rate-Master visibility funnels through `canViewCosts()` / `canEditRates()` in `client/src/lib/roles.ts`. Owner/Manager see costs; Staff see quantities + balances only.
- **Note:** auth is currently hardcoded to an OWNER user (`AuthContext`), so this gating is **UI-only**. A demo "View as role" switcher (stored in settings) lets you preview the Staff experience; swap to real backend roles by changing the two helpers.

### Acceptance test — verified in-browser
Brand "Test", Qty 10000, Size 18x28, Metalized → Printing (in 500 / out 480 / rej 20; ink 8, ethyl 12, toluene 6) computed Printing **₹3,588.00**, balance 0, yield 96%; full card totalled **₹50,353.00**, cost/bag ₹5.04, cost/kg ₹66.25, wastage 35 kg. Staff view confirmed to show quantities but **no ₹ figures** and no Rate Master.

---

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
