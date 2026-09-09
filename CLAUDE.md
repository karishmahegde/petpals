# PetPals — Animal Adoption Management System

Multi-shelter pet adoption platform (solo full-stack learning project). Unifies animal listings, adoption workflows, and medical records across every branch of a shelter organisation. Differentiators: (1) network-wide search & workflows, (2) universal health passport that travels with an animal across inter-shelter transfers, (3) AI pet–adopter compatibility matcher (OpenAI, Sprint 6).

**Roles:** Admin (org oversight, shelters, analytics) · Shelter Staff (pets, applications, volunteers, events, donations) · Adopter (browse, apply, schedule visits, track status) · Veterinarian (appointments, vaccinations, health passport) · Volunteer (assigned tasks) · Donor (donations + history).

---

## Tech Stack

**Frontend (`client/`):** React 18 + Vite + TS · React Router v6 · Zustand (auth `{ user, token, role }`, access token in memory) · TanStack Query (all server state) · Axios (`logic/api/axiosInstance.ts`) · Tailwind (tokens in `tailwind.config.js`: rose/gold/teal + neutrals; Benne display, Montserrat body) · react-icons (Fa/Hi/Pi/Tb) · react-hot-toast (`<Toaster/>` mounted once near root, styled there — not per call) · embla-carousel (Home carousel autoplay, Featured Pets slider drag-only).

**Backend (`server/`):** Node 18 + Express · Prisma (`server/src/prisma/schema.prisma`) · PostgreSQL 15 + PostGIS (`ST_MakePoint/SetSRID/Distance/DWithin`) · Supabase (managed Postgres + storage; buckets `pet-images`, `government-ids` private) · `zipcodes` npm (offline US zip→coords, behind `services/geocoding/`) · JWT two-token · bcrypt (10 rounds) · cookie-parser · node-cron (nightly TokenDenylist cleanup) · Stripe (application-fee Checkout).

**Infra:** Docker Compose (local) · Vercel (FE) / Railway (BE) · branches `main` → `dev` → `feature/*`.
**Testing:** Jest + Supertest (unit + integration, target 70%) · Cypress (critical adoption flows only).

---

## ⚠️ Permanent Known Issues

- **PostGIS migration drift (CRITICAL) — never run `npx prisma migrate dev`.** It detects drift from the hand-added `shelterLocation` geography column and offers to reset the DB. For any schema change: edit `schema.prisma` → apply the SQL directly in the Supabase editor → `npx prisma generate`. After any DB reset, re-add all hand-applied constraints, including:
  ```sql
  ALTER TABLE "Shelter" ADD COLUMN "shelterLocation" geography(Point, 4326);
  ```
  Seed uses `prisma.$executeRaw` for PostGIS values — intentional.
- **`CHAR(n)` padding:** right-pads with spaces, breaking strict string compares. Use `VARCHAR` unless the declared length exactly matches content width (`*Sex CHAR(1)` are safe; `petSex` was fixed `CHAR(2)`→`CHAR(1)`). Check on every new fixed-length column.
- **TanStack `queryKey` must include everything `queryFn` reads** — not just the state that looks like "the input". A computed override driven by other state silently breaks refetching if it's not in the key.
- **Age filter:** `petDOB` → `buildAgeFilter(minAge, maxAge)`. `minAge` = direct `lte`; `maxAge` = shift the cutoff back one month **and** use strict `gt` (not `gte`). Both parts required together.

---

## Authentication (Sprint 1 ✅)

Two-token: **access** (Zustand memory, 15 min, `Authorization: Bearer` on every protected call) + **refresh** (httpOnly cookie, 7 days, only issues new access tokens). Central `USERS` table (`userID` PK/FK shared by all six role tables) holds `userEmail`, `userPassword` (hashed), `role`, `refreshToken` (hashed).

**Session restore:** `App.tsx` calls `POST /auth/refresh-token` (cookie) on every load; success populates Zustand incl. the name from the role table, failure → public pages only.

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `POST /auth/register` | — | `USERS` + role row atomically via `$transaction` |
| `POST /auth/login` | — | access token + httpOnly cookie; name from role table |
| `POST /auth/logout` | Bearer | nulls `USERS.refreshToken`, clears cookie |
| `POST /auth/refresh-token` | cookie only | — |

**Guards:** FE `ProtectedRoute` (→ `/login` if no token), `RoleRoute` (→ `/forbidden` if wrong role). BE `authenticate.js` (verifies Bearer, sets `req.user`), `authorizeRoles('Staff','Admin')` factory.

**Post-login redirect (Sprint 3):** `/login?redirect=/adopt/apply/5` — a query param (survives a mid-login refresh). Adopter → `redirect`; other roles → `/adopt` + "need an adopter account" toast; no param → role-dashboard default. The same branch handles post-login and an already-authed user hitting `/login`.

---

## Folder Structure

```
client/src/
  logic/
    api/         axiosInstance, authApi, petsApi, adoptersApi, adoptionApplicationsApi, visitsApi
    route/       ProtectedRoute, RoleRoute
    store/       useAuthStore (Zustand: { user, token, role })
    toast/       shared toast helpers
    adopter/     adopter-domain view helpers (applicationStatus.ts)
    geocoding/   (empty — server-side only)
  static/        assets/images/branding/ · content/ (CMS-ready page copy, one file/folder per page)
  components/
    ui/          generic primitives (Card, ButtonElement, Avatar, ConfirmActionModal, Phone*, SegmentedControl)
      marketing/ SectionContainer, SectionHeading[Center]
      pets/      PetCatalogCard, PetDetailsModal, FilterControls
      dashboard/ DashboardHeading, DashboardWidgetHeader, DashboardList, StatTile
    layout/      Navbar, Footer, PublicLayout, DashboardNavbar, DashboardSidebar
  pages/
    public/      home/ · adopt/ (PetCatalog.tsx owns filter state; PetFilterBar, ShelterLocationFilter) · auth/ · about/ · volunteer-info/
    errors/      Forbidden, NotFound
    protected/adopter/
      apply/       AdoptApply, AdoptApplyConfirmation   (the /adopt/apply/* funnel)
      onboarding/  OnboardingWizard + steps/
      shared/      GovernmentIdSection   (used by onboarding + Profile)
      dashboard/   DashboardLayout + DashboardRoutes + one file per tab
                   (Overview, Pets, Appointments, Favorites, Applications, Visits, Profile) + CloseAccountModal
        overview/  *Widget.tsx
        shared/    ApplicationsList, VisitsList
    (staff/ vet/ volunteer/ donor/ admin/ — planned)
  App.tsx        routes + session restore on mount

server/src/
  routes/ controllers/ services/   grouped auth/ public/ adopter/ — one <domain>.<layer>.js per file
  middleware/   authenticate, authorizeRoles, errorHandler, upload
  services/geocoding/   index.js is the ONLY import; usPostalCodeGeocoder.js the only US-aware file
  services/storage/     index.js is the ONLY import (Supabase Storage)
  utils/        errors.js, response.js
  config/prisma.js   singleton Prisma client (PrismaPg adapter)
  prisma/       schema.prisma, seed.js
  tests/        unit/ integration/
  app.js / index.js
```

### Component Placement

- Generic, content-agnostic, reused anywhere → `components/ui/`
- Generic but scoped to one area → `components/ui/<area>/` (`marketing/`, `pets/`, `dashboard/`)
- Shared by 2+ screens of one feature → a `shared/` folder beside them (e.g. `dashboard/shared/`)
- Imports a feature's API or hard-codes its routes → beside the feature under `pages/`, never `components/`
- Otherwise page-specific → sibling of the page that owns it

### State Ownership

State lives in exactly one place (the page component); everything below relays — renders props, reports up via callbacks, keeps no competing copy. Conditional render (`{isOpen && <X/>}`) unmounts/resets state; the `hidden` class preserves it — choose per whether state should survive a collapse/expand.

---

## API

Base: `http://localhost:5000/api/v1` (dev) · `https://petpals-api.up.railway.app/api/v1` (prod). Everything under `/api/v1/`.

**Conventions:** plural nouns · kebab-case multi-word (`/adoption-applications`) · no verbs in URLs · one nesting level (`/pets/:id/photos`) · query params for filter/sort/paginate · `PATCH /<resource>/:id/status` for status changes.

**Response envelope:**
```json
{ "success": true,  "message": "...", "data": {…|[…]}, "pagination"?: { "page", "limit", "total", "totalPages" } }
{ "success": false, "message": "...", "error": { "code": "NOT_FOUND", "details": "..." } }
```
`GET /pets/featured` returns a bare array (no envelope pagination).

**Error codes:** `BAD_REQUEST` 400 · `UNAUTHORIZED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `VALIDATION_ERROR` 422 · `INTERNAL_SERVER_ERROR` 500.

### Public pet catalog (Sprint 2 ✅ — all no-auth)

`GET /pets` (full filter set — see Filter System) · `/pets/:id` · `/pets/featured` (`featuredFlag=true AND adoptionStatus="available"`) · `/species` (alpha) · `/breeds` (cascading, repeatable `speciesID`) · `/shelters` (open) · `/shelters/nearby` (`lat`/`lng` **or** `postalCode`, `radius` default 25 km).

### Adopter portal (Sprint 3)

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET / PUT | `/adopters/me` | profile |
| GET | `/adopters/me/applications` | paginated; `status`, `petID`, `limit` |
| POST | `/adoption-applications` | returns a $15 Stripe Checkout URL; the row is created by the **Stripe webhook after payment**, not here |
| GET | `/adoption-applications/:id` | adopter (own) or staff |
| PATCH | `/adoption-applications/:id/status` | `{ status: "Withdrawn" }` — adopter, from `Pending`/`Accepted`; fee non-refundable, re-apply OK. Staff transitions TBD |
| GET / POST | `/adopters/me/visits` · `/visits` | `?upcoming=true` |
| PATCH | `/visits/:id` | `{ visitStatus: "Cancelled" }` — adopter, future non-closed visits. Staff confirm/complete TBD |
| GET | `/adopters/me/appointments` | `?upcoming=true`; vet appointments for pets the adopter has an **Accepted** application for. Vet CRUD is Sprint 5 |
| GET | `/adopters/me/favorites` · `/adopters/me/adopted-pets` | favorites = full pet-detail shape; adopted-pets = `PetCard` shape |
| GET / POST | `/adopters/me/government-id` | ID-doc upload → `government-ids` bucket |

### Domains not yet built

Staff `/staff` · Appointments (vet CRUD) `/appointments` · Vaccinations `/appointments/:id/vaccinations` · Tasks `/tasks` · Events `/events` · Donors `/donors` · Donations `/donations` · Transfers `/transfers`.

---

## Filter System (Sprint 2 ✅)

Public catalog (`/adopt`), six independent filters. Full ref: `docs/09-Filter_System_Deep_Dive.docx`.

- **Live vs. staged:** species/breed/size/age refine instantly; location search needs an explicit "Find Nearby Shelters" trigger (two-step network chain).
- **Shelter filtering:** `selectedShelterIDs` (manual) and `nearbyShelterIDs` (location) kept as separate arrays — different lifecycles, gold "Nearby" badge — merged as a deduped union only when building the `/pets` request. A zero-result location search sets `shelterID = [-1]` (sentinel, never matches) to distinguish "searched, found nothing" from "no filter".
- **PostGIS:** `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` — **lng first**. `ST_Distance` measures (m→km, 2dp); `ST_DWithin` filters (uses the spatial index).
- **Home handoff:** `Searchbar.tsx` never fetches — it builds a `/adopt` URL and navigates; `PetCatalog.tsx` reads params once on mount and seeds state via the same setters used elsewhere (no parallel path).
- **Species** filtering is ID-based (`?speciesID=1`), matching `/breeds`.

---

## Adopter Portal (Sprint 3 — in progress)

**PetDetailsModal** (`components/ui/pets/`) — opens over `/adopt` via card click or `?petID=X` deep link. `openId` + URL-reading logic live in the *page* (`PetCatalog.tsx`, or `Overview.tsx` for the dashboard widgets), never in `PetCatalogCard` — the card takes `openId` + `onKnowMore(petID)` props (it's reused on `/adopt`, Home Featured Pets, and dashboard `PetsWidget`/`FavoritesWidget`). "Adopt" button: not logged in → `/login?redirect=/adopt/apply/:petID`; Adopter + pet `available` → `/adopt/apply/:petID`; otherwise the modal closes + a toast (same copy as the `/login` non-adopter toast).

**AdoptApply** (`apply/AdoptApply.tsx`) — re-runs **every** guard on mount (not just at click-time), independent of entry path: not logged in → `/login?redirect=`; not an Adopter → `/adopt` + toast; pet re-fetched and not `available` → `/adopt` + toast; existing `Pending`/`Accepted` application (`GET /adopters/me/applications?petID=`) → `/adopter/applications` + toast. Deliberately does **not** use `ProtectedRoute`/`RoleRoute` — their fixed `/login`/`/forbidden` targets don't match this flow's redirects and toasts.

**Application submit** → `POST /adoption-applications` returns a Stripe Checkout URL; the `AdoptionApplication` row is created by the Stripe webhook after payment, not synchronously. Confirmation lands on `apply/AdoptApplyConfirmation.tsx`.

**Dashboard** (`/adopter/*`): `dashboard/DashboardLayout` (navbar + sidebar) → `DashboardRoutes` → one file per tab (`Overview`, `Pets`, `Appointments`, `Favorites`, `Applications`, `Visits`, `Profile`).

**Overview widgets** (`dashboard/overview/*Widget.tsx`) — each a self-contained `Card` owning its own `useQuery` + loading/empty state; title row via `DashboardWidgetHeader`.

**Dashboard-list pattern** (Applications + Visits), three layers:
1. `*Widget` / tab page — does the `useQuery`, renders the shell, hands the array down.
2. `dashboard/shared/{Applications,Visits}List.tsx` — feature glue, no fetching; supplies `renderRow` (→ one `DashboardListRow`) + a `confirmAction` config. A separate file because both the widget and the full tab page render it.
3. `components/ui/dashboard/DashboardList.tsx` — generic: `DashboardListRow` (row layout) + `DashboardActionList<T>` (owns the `<ul>`, pending-item state, the mutation + toasts + query invalidation, and `ConfirmActionModal`); also `RowMedallion`, `RowActionButton`.

Appointments has no destructive action, so `AppointmentsWidget` uses `DashboardListRow` directly.

Adopter-facing status labels are renames in `logic/adopter/applicationStatus.ts`: Pending → "Under Consideration", Accepted → "Approved", Rejected → "Declined".

---

## Database Notes

- `Pet.petDOB` replaced static `petAge` (age computed at request time). `Pet.featuredFlag BOOLEAN DEFAULT FALSE` powers `/pets/featured` (set via SQL for now, staff toggle planned).
- Hand-applied constraints (PostGIS column, partial unique indexes) live only in Supabase and must be re-added after any reset — see Known Issues. Active-application uniqueness: `UNIQUE (adopterID, petID) WHERE applicationStatus IN ('Pending','Accepted')`.

---

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NF-01 | bcrypt + two-token JWT (access 15m + refresh 7d httpOnly) |
| NF-02 | RBAC on all endpoints via `authorizeRoles` |
| NF-03 | API response < 500 ms for standard CRUD |
| NF-04 | New shelters via admin panel only — no architectural changes |
| NF-05 | 99.5% uptime target |
| NF-06 | ACID transactions for adoption-critical data |
| NF-07 | PostGIS for location-based search |
| NF-08 | 70% test coverage; unit + integration priority |
| NF-09 | Responsive + accessible, desktop + mobile |
| NF-10 | Sensitive fields never exposed in API responses |
| NF-11 | All endpoints documented via Swagger/OpenAPI |
| NF-12 | Consistent structured error responses |

---

## Sprint Plan

| # | Focus | Status |
| --- | --- | --- |
| 1 | Auth + project setup | ✅ |
| 2 | Public portal — catalog, filter system, Home, PetDetailsModal | ✅ |
| 3 | Adopter portal — profile, dashboard, application flow + withdraw, visits (list + cancel), appointments (read-only), favorites, /login redirect-back | 🚧 |
| 4 | Shelter staff + admin operations | — |
| 5 | Vet, volunteer, donor flows (incl. vet-managed appointments/vaccinations) | — |
| 6 | AI compatibility matcher (OpenAI API) | — |
| 7 | Testing to 70% + cleanup (remove TokenDenylist → RefreshTokens table) | — |
| 8 | Deployment, polish, final report | — |

---

## Code Style

- 2-space indent · single quotes (JS) · TS throughout frontend · async/await, not `.then()` chains
- Controllers thin — business logic in services · standard response envelope on every response
- **Never expose** `userPassword`, `refreshToken`, `governmentID`, `stripeCustomerID`
- Prisma for all DB access — raw SQL only for PostGIS (`prisma.$queryRaw`)
- Tests in `server/src/tests/unit|integration/`; integration seeds via API calls, cleans up via Prisma in `afterAll`, runs `--runInBand`
- Filters: closed/fixed-value validated strictly (400 on bad input); open/DB-driven unvalidated (unmatched value → zero rows, not an error)
- React state: never mutate in place — build a new array/object every time (`.filter`/`.map`/spread); reference equality drives re-renders
