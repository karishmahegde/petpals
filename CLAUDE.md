# PetPals — Animal Adoption Management System

Multi-shelter pet adoption platform (solo full-stack learning project). Unifies animal listings, adoption workflows, and medical records across every branch of a shelter organisation. Differentiators: (1) network-wide search & workflows, (2) universal health passport that travels with an animal across inter-shelter transfers, (3) AI pet–adopter compatibility matcher (OpenAI, planned — Sprint 7).

**Roles:** Admin (org oversight, shelters, analytics) · Shelter Staff (pets, applications, volunteers, events, donations) · Adopter (browse, apply, schedule visits, track status) · Veterinarian (appointments, vaccinations, health passport) · Volunteer (assigned tasks) · Donor (donations + history).

---

## Tech Stack

**Frontend (`client/`):** React 18 + Vite + TS · React Router v6 · Zustand (auth `{ user, token, role }`, access token in memory) · TanStack Query (all server state) · Axios (`logic/api/axiosInstance.ts`) · Tailwind (tokens in `tailwind.config.js`: rose/gold/teal + neutrals; Benne display, Montserrat body) · react-icons (Fa/Hi/Pi/Tb) · react-hot-toast (`<Toaster/>` mounted once near root, styled there — not per call) · embla-carousel (Home carousel autoplay, Featured Pets slider drag-only).

**Backend (`server/`):** Node 18 + Express · Prisma (`server/src/prisma/schema.prisma`) · PostgreSQL 15 + PostGIS (`ST_MakePoint/SetSRID/Distance/DWithin`) · Supabase (managed Postgres + storage; buckets `pet-images`, `government-ids` private) · `zipcodes` npm (offline US zip→coords, behind `services/geocoding/`) · JWT two-token · bcrypt (10 rounds) · cookie-parser · node-cron (nightly TokenDenylist cleanup) · Stripe (application-fee Checkout).

**Infra:** Docker Compose (local) · Vercel (FE) / Railway (BE) · branches `main` → `dev` → `feature/*`.
**Testing:** Jest + Supertest (unit + integration, target 70%) · Cypress (critical adoption flows only — `client/cypress/e2e/`; needs both dev servers running locally, `npm run cypress:open` / `cypress:run` from `client/`). Specs seed their own data via `cy.request()` straight to the API (e.g. `cy.registerTestAdopter()`), never pre-existing fixtures.

---

## ⚠️ Permanent Known Issues

- **PostGIS migration drift (CRITICAL) — never run `npx prisma migrate dev`.** Prisma can't model the PostGIS `shelterLocation` column or the generated reference-code columns, so `migrate dev` sees them as drift and offers to reset the DB. `migrate deploy` is safe. The single baseline migration (`server/src/prisma/migrations/20260926000000_baseline/`) builds the whole schema, those columns and the partial unique indexes included, so a fresh DB only needs `npm run setup` from `server/` (migrate deploy → generate → `setup/setup-storage.js` for the storage buckets + seed photos → seed; first-time only, since the seed wipes). For any schema change: edit `schema.prisma` → write the SQL as a **new** migration folder `migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql` (draft it with `npx prisma migrate diff --from-config-datasource --to-schema src/prisma/schema.prisma --script`, deleting the generated-code `DROP DEFAULT` noise and the `DROP INDEX "Shelter_shelterLocation_idx"` line — that's the PostGIS spatial index Prisma can't see, and `/shelters/nearby` depends on it) → `npx prisma migrate deploy` → `npx prisma generate`. Never edit an applied migration, and never apply schema SQL by hand only — a fresh setup would miss it.
  Seed uses `prisma.$executeRaw` for PostGIS values — intentional. **The seed wipes every table first** (deterministic IDs/data) and covers every enum value — keep it that way when adding statuses. Seed pet photos live in `setup/pet-images/<petname>.webp` (uploaded to `pet-images/seed/`); a new seeded pet needs its photo added there. `setup/placeholder.jpg` → `pet-images/placeholder.jpg` is what every app-created pet shows until a real photo is uploaded (`PLACEHOLDER_PHOTO` in `staff/pets.service.js`). Seeded ID verifications point at `setup/government-ids/*.png` (fake, SAMPLE-watermarked; uploaded to the private `government-ids/seed/`).
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

**Guards:** FE `ProtectedRoute` (→ `/login?redirect=<path+search>` if no token, or the worker login for worker dashboards — see below), `RoleRoute` (→ `/forbidden` if wrong role). BE `authenticate.js` (verifies Bearer, sets `req.user`), `authorizeRoles('Staff','Admin')` factory.

**Staff onboarding before approval (Sprint 5.2):** new staff sign up Pending and onboard *before* they're approved (wizard: 2 Personal, 3 Address, 4 Identity/government ID, 5 Review; mandatory, no skip). Pending **Staff**, **Veterinarians** and **Volunteers** can log in (Pending Admin still can't) — the role list is `PENDING_LOGIN_ROLES` in `services/auth/pendingRoles.js`, shared by login and the middleware; login/refresh return `onboardingComplete`, `onboardingStep` (every role but Admin) and `accountStatus` (Staff + Vet + Volunteer). Plain `authenticate` still rejects Pending on every route — only routes wired with **`authenticate.allowPending`** admit a Pending staff member or vet: `GET/PUT /staff/me`, `GET/POST /staff/me/government-id`, `PATCH /staff/me/onboarding-step` + `/onboarding-complete`, the same set under `/vets/me` (`routes/vet/vets.routes.js` — vet self-service, mirroring `/staff/me`'s shapes and status codes) and under `/volunteers/me` (`routes/volunteer/volunteers.routes.js`, mounted in `app.js` **before** the staff volunteers router so `GET /volunteers/:id` can't catch `/volunteers/me`), `POST /auth/logout`. Keep that list minimal. **Approval** (Manager `PATCH /staff/me/team/:id/status` and `PATCH /staff/me/vets/:id/status`; Admin `PATCH /staff/:id/status` for Manager sign-ups; any staff member at the shelter `PATCH /volunteers/:id/status`) requires onboarding complete **and** a Verified government ID — enforced in `services/staff/staffApproval.service.js` (409 otherwise; every export takes the `userType`: `Staff`, `Veterinarian` or `Volunteer`), which also adds `governmentIdStatus` to the approvers' staff, vet and volunteer roster shapes. Declining is allowed at any stage. Existing staff, and every non-Pending vet and volunteer, were backfilled as onboarded (migrations `…_staff_onboarding_backfill`, `…_vet_onboarding_backfill`, `…_volunteer_onboarding_backfill`).

**Post-login redirect (Sprint 3):** `/login?redirect=/adopt/apply/5` — a query param (survives a mid-login refresh), URL-encoded. Any guarded route can send one — `ProtectedRoute` builds it from `location.pathname + location.search` for every protected page, and the adopt-apply flow's own navigates (`PetDetailsModal`, `AdoptApply`) set it explicitly. Login is mostly role-agnostic about it: redirect present → go there, else → role-dashboard default (`resolveDestination` in `logic/route/`, which also owns the role → dashboard map — Veterinarian is `/vet`). One exception: a redirect into *another* role's dashboard (e.g. `/staff/...` after logging in as Admin) falls back to the user's own dashboard, since it could only end at `/forbidden`. Ending a session from the UI (Log out, closing your own account) must go through **`useEndSession`** (`logic/hooks/`), which navigates away and clears the session inside one `flushSync` — calling `navigate()` then `logout()` separately isn't enough, since the Zustand update can re-render before the router applies the navigation, and `ProtectedRoute` then captures the current page as a stale `redirect`. Where a session ends up is by role (`logoutDestinationFor` / `loginPathFor` in `resolveDestination.ts`): workers (Admin, Staff, Veterinarian) go to the worker login `/staff-portal/login` after Log out or a 401; everyone else goes home (`/`) on Log out and to `/login` on a 401. `ProtectedRoute` likewise sends a signed-out visitor on a worker dashboard (`/staff`, `/admin`, `/vet`) to the worker login, keeping `?redirect=` (`loginPathForPage`). The same branch handles post-login and an already-authed user hitting `/login` directly. Otherwise role correctness is the *destination's* job, not Login's — `RoleRoute` bounces a mismatched role to `/forbidden`, and `AdoptApply` (which bypasses `RoleRoute`) re-checks role itself → `/adopt` + toast.

---

## Folder Structure

```
client/src/
  logic/
    api/         axiosInstance, authApi, petsApi, adoptersApi, adoptionApplicationsApi, visitsApi, vetsApi (/vets/me/*, POST /pets/:id/health-records), vaccinationsApi (/vaccines catalogue + appointment doses), donorsApi (/donors/me/*, /donations/checkout), volunteersApi (/volunteers/me self-service) vs shelterVolunteersApi (staff's /volunteers), selfGovernmentIdApi (per-role /me/government-id calls)
    route/       ProtectedRoute, RoleRoute
    store/       useAuthStore (Zustand: { user, token, role })
    toast/       shared toast helpers
    adopter/     adopter-domain view helpers (applicationStatus.ts)
    geocoding/   (empty — server-side only)
  static/        assets/images/branding/ · content/ (CMS-ready page copy, one file/folder per page)
  components/
    ui/          generic primitives (Card, ButtonElement, Avatar, Modal + ModalActions, ConfirmActionModal, Phone*, SegmentedControl)
      marketing/ SectionContainer, SectionHeading[Center]
      pets/      PetCatalogCard, PetDetailsModal, FilterControls
      dashboard/ DashboardHeading, DashboardWidgetHeader, DashboardList, StatTile
      onboarding/ OnboardingProgress, OnboardingStepHeader, OnboardingStepNav, PersonalFields, AddressFields (shared by every role's wizard)
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
    protected/shared/   used by 2+ roles: AwaitingApproval (role prop — /staff/pending, /vet/pending, /volunteer/pending: Pending staff/vets/volunteers wait here once onboarded) · GovernmentIdSection (takes an `api` from logic/api/selfGovernmentIdApi.ts — staffGovernmentIdApi / vetGovernmentIdApi / volunteerGovernmentIdApi) · HealthPassport (role prop — /staff/pets/:petID/health-passport, /vet/health-records/:petID/health-passport; vet-only Add Record → AddHealthRecordModal) · PetsFilterBar (Species/Breed/Size/Age + optional Status — Staff Pets tab and vet Health Records) · idVerification/
    protected/staff/
      onboarding/  StaffOnboardingWizard + steps/   (mandatory, before approval)
      dashboard/   DashboardLayout routes + one file per tab
    protected/vet/
      onboarding/  VetOnboardingWizard + steps/   (same 2–5 wizard as staff, /vet/onboarding/step/:step; OnboardingGate routes Pending vets here, then to /vet/pending)
      dashboard/   DashboardRoutes (inside the shared components/layout/DashboardLayout; sidebar menu = ROLE_NAV.Veterinarian) + one file per tab (Overview, Appointments, HealthRecords, Vaccinations, Profile)
        overview/  StatsWidget + *Widget.tsx (Today's Appointments — useTodaysAppointments merges the upcoming and past halves so earlier-today ones count; Overdue Vaccinations — rows open the pet's passport, View All → Health Records; Shelter Details). Tile and widget share each query
        sections/  appointments/ (AppointmentDetailPanel, EditAppointmentForm, RecordVaccineForm) · vaccinations/ (VaccineFormPanel — Add/Edit Vaccine slide-over)
        shared/    CloseAccountModal (DELETE /vets/me; the 409 upcoming-appointments block is its own panel, not a generic error; success → worker login)
    protected/volunteer/
      onboarding/  VolunteerOnboardingWizard + steps/   (same 2–5 wizard, /volunteer/onboarding/step/:step; OnboardingGate → wizard, then /volunteer/pending)
      dashboard/   DashboardRoutes (inside the shared DashboardLayout; sidebar menu = ROLE_NAV.Volunteer) + one file per tab (Overview; Tasks — status + due-date filters, Mark Completed via DashboardActionList; Events — read-only, vet-Appointments layout: Upcoming card with Status (all/assigned) + Event Date (`dateTo` on GET /volunteers/me/events) filters, Past card = events they were on; "Assigned to you" badge, since staff assign volunteers and there's no self sign-up; Appointments — read-only Upcoming/Past cards; Availability — editable AvailabilityGrid, local draft until Save → PUT /volunteers/me/availability; Profile — same as the vet Profile) · shared/ DateBlock, CloseAccountModal (DELETE /volunteers/me; the 409 carries `error.details.blockers` — "appointments"/"tasks" — and the blocked panel links to each; success → home, volunteers aren't workers)
        overview/  StatsWidget + MyTasks/NextEvents/AppointmentsWidget; overviewQueries.ts holds each query, shared by its tile (pagination.total) and widget. Shelter Details is protected/shared/ShelterDetailsWidget (vet + volunteer)
    protected/donor/
      onboarding/  DonorOnboardingWizard + steps/   (2 Personal, 3 Address, 4 Review — no ID; skippable like the adopter's: OnboardingGate's SKIPPABLE_ROLE_PATHS)
      dashboard/   DashboardRoutes (shared DashboardLayout; ROLE_NAV.Donor = Overview, Donate, Donation History) — Overview (stats tiles, donate form, Recent Donations), Donate, DonateConfirmation (/donor/donate/confirmation — Stripe success_url; polls ?checkoutSessionId= until the webhook records the donation, then invalidates ["donor","donations"]); History (shelter + date-range filters → dateFrom/dateTo, rows with donationCode, plus a By Shelter totals card from the stats byShelter, which also feeds the shelter filter); Profile (vet/volunteer Profile layout, no government ID; shared/CloseAccountModal — no 409 case, ends on / like Log out)
        shared/    DonateForm (Open + Full shelters via public GET /shelters?acceptingDonations=true, $25/$50/$100/$200/custom whole dollars, optional message → POST /donations/checkout → Stripe)
        overview/  donorQueries.ts (keys under ["donor","donations"]), StatsWidget, RecentDonationsWidget
  App.tsx        routes + session restore on mount

server/src/
  routes/ controllers/ services/   grouped auth/ public/ adopter/ staff/ admin/ vet/ webhooks/ — one <domain>.<layer>.js per file
  middleware/   authenticate, authorizeRoles, errorHandler, upload
  services/geocoding/   index.js is the ONLY import; usPostalCodeGeocoder.js the only US-aware file
  services/storage/     index.js is the ONLY import (Supabase Storage)
  services/governmentIds/selfGovernmentId.service.js   every role's GET/POST /<role>/me/government-id (keyed by userType) — add new roles to its OWNERS map, don't copy it
  utils/        errors.js, response.js
  config/prisma.js   singleton Prisma client (PrismaPg adapter)
  prisma/       schema.prisma, seed.js
  tests/        unit/<role>/ (Prisma fully mocked) · integration/<role>/ (live DB; journey files sprint3Journeys, adminJourneys, sprint5_1Journeys, sprint5_2Journeys, staffOnboarding.journey, vet/sprint6Journeys)
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
| GET | `/adopters/me/appointments` | `?upcoming=true`; vet appointments for pets the adopter has an **Accepted** application for |
| GET | `/adopters/me/favorites` · `/adopters/me/adopted-pets` | favorites = full pet-detail shape; adopted-pets = `PetCard` shape |
| GET / POST | `/adopters/me/government-id` | ID-doc upload → `government-ids` bucket |

### Vet portal (Sprint 6 ✅)

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET / PUT | `/vets/me` | profile; `allowPending` (onboarding) — see Staff onboarding above |
| GET / POST | `/vets/me/government-id` | shared `selfGovernmentId.service.js` |
| DELETE | `/vets/me` | mirrors `DELETE /staff/me`: `{ mode: deactivate|delete }` (422 otherwise); 409 while the vet has upcoming Scheduled appointments. `delete` removes Veterinarian + Users rows and the government ID + its Storage file; history survives because `Appointment.vetID` (nullable since migration `…_appointment_vet_set_null`), `HealthRecord.vetID` and `VaccinationRecord.administeredBy` are all `ON DELETE SET NULL` — so an appointment's `vetName` can be null (client `formatVetName` shows "Former vet") |
| PATCH | `/vets/me/onboarding-step` · `/onboarding-complete` | 2–5, same wizard as staff |
| GET | `/vets/me/appointments` · `/:id` | own queue only (`vetID` = caller); list reuses the Staff `/appointments` select, item shape, `deriveAppointmentStatus` and upcoming/past split (exported from `staff/appointments.service.js`); `upcoming` strictly `true`/`false`; optional `dateFrom`/`dateTo` (inclusive ISO range — the client computes "today"/"next 7 days" in local time); another vet's `:id` → 404. Detail also returns the stored `appointmentStatus` next to the displayed `status` (a past Scheduled one *displays* Completed but can still be completed — the vet UI's Mark Completed keys off the stored value) |
| PATCH | `/appointments/:id/status` | `{ appointmentStatus: "Completed", notes? }` — the only real write of Completed; assigned vet only (another vet's → 404, like the GETs), stored Scheduled only (409), not before `appointmentDate` (409); `notes` → a `HealthRecord` linked via `HealthRecord.appointmentID` (nullable, like `VaccinationRecord.appointmentID`; migration `…_health_record_appointment`) in the same `$transaction`. Staff `PATCH /appointments/:id/cancel` is separate. Displayed status everywhere (Staff, vet, adopter) goes through `deriveAppointmentStatus`: written Completed and past-Scheduled both read Completed |
| PATCH | `/appointments/:id` | Staff's edit route, also open to the **assigned vet** for `appointmentDate` + `appointmentReason` only (400 for vetID/staffID/volunteerID; another vet's → 404; vet gets the `/vets/me/appointments/:id` shape back, no adopter details). Vets can't cancel — `/appointments/:id/cancel` stays Staff/Admin |
| GET / POST · PUT | `/vaccines` · `/vaccines/:id` | network-wide catalog (no shelter), alphabetical; GET (`?name=` contains) — Admin/Staff/Veterinarian; POST/PUT — Veterinarian/Admin, PUT partial, `""`/null clears manufacturer/vaccineDesc; same name + manufacturer (case-insensitive) → 409 (service pre-check, no index) |
| GET | `/vets/me/vaccinations/overdue` · `/vets/me/stats` | Overview data. Overdue: per active (not adopted/deceased) pet at the vet's shelter and vaccine, only the **latest** dose counts; `doseNumber` = doses given + 1, `daysOverdue`; most overdue first. Stats: `petsTreated` = distinct pets at the vet's past, non-cancelled appointments |
| GET | `/vets/me/pets` · `/:id` · `/:id/health-passport` | pets at the vet's shelter. List: Staff `/staff/me/pets` params via the shared `parseShelterPetsQuery` + `listShelterPets` core, plus `petName`. Detail/passport reuse the Staff handlers; `getShelterPetDetail` scopes a Veterinarian to their shelter (elsewhere → 404). Passport is universal — records, doses, transfers read by `petID` only, so history from shelters the pet left is included |
| POST | `/pets/:id/health-records` | standalone note, `recordDesc` ≤500; `vetID` = caller; pet must be at the vet's shelter (403) |
| PUT | `/health-records/:id` | `recordDesc` only; only the vet who wrote it (403), incl. appointment-completion notes |
| GET / POST | `/appointments/:id/vaccinations` | doses given at the appointment. POST: assigned vet only; body `vaccineID`, `administeredDate`, optional `dueDate` (null = no further dose planned — never overdue; passport status "No Further Dose"; client wording via `logic/utils/vaccination.ts`; nullable since migration `…_vaccination_due_date_optional`) — `petID`, `administeredBy`, `administeredAt` (appointment's shelter) and `appointmentID` set server-side; any status but Cancelled (409); future `administeredDate` or `dueDate` not after it → 422; unknown vaccineID → 404. GET: assigned vet, Staff at that shelter (403 otherwise), Admin. Another vet's appointment → 404 on both |

### Domains not yet built

Volunteer portal (volunteer self-service — staff-side `/volunteers` and `/tasks` exist) · Donor portal `/donors` (staff-side `/donations` exists) · AI compatibility matcher.

---

## Filter System (Sprint 2 ✅)

Public catalog (`/adopt`), six independent filters. Full ref: `docs/09-Filter_System_Deep_Dive.docx`.

- **Live vs. staged:** species/breed/size/age refine instantly; location search needs an explicit "Find Nearby Shelters" trigger (two-step network chain).
- **Shelter filtering:** `selectedShelterIDs` (manual) and `nearbyShelterIDs` (location) kept as separate arrays — different lifecycles, gold "Nearby" badge — merged as a deduped union only when building the `/pets` request. A zero-result location search sets `shelterID = [-1]` (sentinel, never matches) to distinguish "searched, found nothing" from "no filter".
- **PostGIS:** `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` — **lng first**. `ST_Distance` measures (m→km, 2dp); `ST_DWithin` filters (uses the spatial index).
- **Home handoff:** `Searchbar.tsx` never fetches — it builds a `/adopt` URL and navigates; `PetCatalog.tsx` reads params once on mount and seeds state via the same setters used elsewhere (no parallel path).
- **Species** filtering is ID-based (`?speciesID=1`), matching `/breeds`.

---

## Adopter Portal (Sprint 3 ✅)

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

## Vet Portal (Sprint 6 ✅)

Tabs under `/vet/*`: **Overview** · **Appointments** (queue + `AppointmentDetailPanel`: edit date/reason, record doses, complete with notes) · **Health Records** (pets at the vet's shelter via `GET /vets/me/pets` — pet-name search + the shared `PetsFilterBar`; every filter and the search are in the `queryKey`; rows → View Health Passport) · **Vaccinations** (the network-wide vaccine catalogue — search, Add/Edit via `VaccineFormPanel`; saving invalidates every `["vaccines"]` query so the appointment dose picker updates) · **Profile** (same layout as the Staff profile; edit mode uses the onboarding `PersonalFields` + `AddressFields` and the same required-field/ZIP validation as the wizard; government ID via the shared `GovernmentIdSection`; Close account → `vet/dashboard/shared/CloseAccountModal`).

**Health passport** (`protected/shared/HealthPassport.tsx`) is one component for Staff and Vet. Read-only for Staff; a vet also gets **Add Record** (`POST /pets/:id/health-records`). Doses are only recorded against an appointment (no standalone dose endpoint), so the passport has no Record Vaccination button. Summarize with AI is a disabled placeholder until the matcher sprint. Editing a vet's own notes isn't wired in the UI — the passport payload doesn't carry the author's `vetID` yet.

---

## Database Notes

- `Pet.petDOB` replaced static `petAge` (age computed at request time). `Pet.featuredFlag BOOLEAN DEFAULT FALSE` powers `/pets/featured` (set via SQL for now, staff toggle planned).
- Partial and expression unique indexes (not expressible in `schema.prisma`) live only in migration SQL — see Known Issues. Case-insensitive name uniqueness (migration `20260927060418_species_breed_name_ci_unique`): `LOWER(speciesName)` table-wide, `(speciesID, LOWER(breedName))` per species; `staff/species.service.js` pre-checks for a clean 409 and maps the index's violation (a race) to the same 409. Active-application uniqueness: `UNIQUE (adopterID, petID) WHERE applicationStatus IN ('Pending','Accepted')`. One Accepted application per pet: `UNIQUE (petID) WHERE applicationStatus = 'Accepted'` (migration `…_one_accepted_application_per_pet`) — accepting an application also declines the pet's other Pending ones with an automatic `staffRemark`, and accepting for a pet that's no longer `available` is a 409; the index stops two simultaneous acceptances. Double-submit guard on Appointment: `UNIQUE (petID, vetID, appointmentDate) WHERE appointmentStatus = 'Scheduled'` — same pet+vet+timestamp can't have two Scheduled rows (a resubmitted create after a perceived failure).

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
| 3 | Adopter portal — profile, dashboard, application flow + withdraw, visits (list + cancel), appointments (read-only), favorites, /login redirect-back | ✅ |
| 4 | Admin operations — shelters, admins, staff oversight, adopters, analytics | ✅ |
| 5.1 | Shelter staff operations — pet management, adoption application review, staff profile | ✅ |
| 5.2 | Shelter staff operations — appointments, visits, transfers, events, volunteers + tasks, donations, species/breeds, team + vet approval, government ID review, staff onboarding before approval | ✅ |
| 6 | Veterinarian portal — onboarding before approval, appointment queue + completion, vaccinations + vaccine catalogue, health records, universal health passport, profile/close account | ✅ |
| 7 | AI compatibility matcher (OpenAI API) | — |
| 8 | Volunteer + donor portals | — |
| 9 | Testing to 70% + cleanup (remove TokenDenylist → RefreshTokens table) | — |
| 10 | Deployment, polish, final report — incl. fixing Docker: `docker-compose.yml` hardcodes a local Postgres (no PostGIS → baseline migration fails) and omits `SUPABASE_SERVICE_ROLE_KEY`; point the server at `server/.env` and drop the bundled DB. Also check `server/Dockerfile`: it runs `npx prisma generate` after a production-only install, but `prisma` is a devDependency. README already documents this target setup (containers run against Supabase via `server/.env`, one-time `npm run setup` from the host), so make compose match it | — |

---

## Code Style

- 2-space indent · single quotes (JS) · TS throughout frontend · async/await, not `.then()` chains
- Controllers thin — business logic in services · standard response envelope on every response
- **Never expose** `userPassword`, `refreshToken`, `governmentID`, `stripeCustomerID`
- Prisma for all DB access — raw SQL only for PostGIS (`prisma.$queryRaw`)
- Tests in `server/src/tests/unit|integration/`; integration seeds via API calls, cleans up via Prisma in `afterAll`, runs `--runInBand`
- Filters: closed/fixed-value validated strictly (400 on bad input); open/DB-driven unvalidated (unmatched value → zero rows, not an error)
- React state: never mutate in place — build a new array/object every time (`.filter`/`.map`/spread); reference equality drives re-renders
- **Verify before merge — frontend and backend are asymmetric:** frontend has `npm run typecheck` + `npm run lint` (run from `client/`) and both must be clean. The backend has **neither** — it's plain JS (no TypeScript, so nothing for a typechecker to check) and ESLint isn't installed or configured there at all (no config file, not in `package.json`). Don't assume a backend lint/typecheck step exists. The closest backend sanity check is loading the app to catch syntax/require errors: `node -e "require('./src/app.js')"`.
