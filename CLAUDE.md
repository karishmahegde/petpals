# PetPals — Animal Adoption Management System

Multi-shelter pet adoption platform (solo full-stack learning project). Unifies animal listings, adoption workflows, and medical records across every branch of a shelter organisation. Differentiators: (1) network-wide search & workflows, (2) universal health passport that travels with an animal across inter-shelter transfers, (3) AI pet–adopter compatibility matcher + health-passport summary (Groq, or any OpenAI-compatible provider, via `services/ai/` — Sprint 8).

**Roles:** Admin (org oversight, shelters, analytics) · Shelter Staff (pets, applications, volunteers, events, donations) · Adopter (browse, apply, schedule visits, track status) · Veterinarian (appointments, vaccinations, health passport) · Volunteer (assigned tasks) · Donor (donations + history).

---

## Tech Stack

**Frontend (`client/`):** React 18 + Vite + TS · React Router v6 · Zustand (auth `{ user, token, role }`, access token in memory) · TanStack Query (all server state) · Axios (`logic/api/axiosInstance.ts`) · Tailwind (tokens in `tailwind.config.js`: rose/gold/teal + neutrals; Benne display, Montserrat body) · react-icons (Fa/Hi/Pi/Tb) · react-hot-toast (`<Toaster/>` mounted once near root, styled there — not per call) · embla-carousel (Home carousel autoplay, Featured Pets slider drag-only).

**Backend (`server/`):** Node 22 + Express · Prisma (`server/src/prisma/schema.prisma`) · PostgreSQL 15 + PostGIS (`ST_MakePoint/SetSRID/Distance/DWithin`) · Supabase (managed Postgres + storage; buckets `pet-images`, `government-ids` private) · `zipcodes` npm (offline US zip→coords, behind `services/geocoding/`) · JWT two-token · bcrypt (10 rounds) · cookie-parser · Stripe (application-fee Checkout) · `services/email/` (optional transactional email — `index.js` is the ONLY import, same rule as ai/; `brevoApi.js` posts to Brevo's HTTPS API over plain `fetch`, no SDK and no SMTP — hosting platforms often block outbound SMTP, especially on free plans; `EMAIL_API_KEY` + `EMAIL_FROM` both set → `isEmailConfigured()`, else every email prints to the server console, links included, so all flows work locally; `queueEmail` is fire-and-forget after the DB commit — a failure is logged, never thrown) · `services/ai/` (optional AI — `index.js` is the ONLY import, same rule as geocoding/ and storage/; `openAiCompatible.js` speaks OpenAI chat-completions over plain `fetch`, no SDK, so Groq/Ollama/OpenRouter are an `.env` change; `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL` all set → `isAiConfigured()`, else features fall back; `generateStructured` sends a strict `json_schema` response format and returns parsed JSON; failures throw with `err.reason` ∈ `AI_ERROR_REASONS` — not_configured, timeout, unreachable, rate_limited, auth_failed, provider_error, invalid_response) · `services/notifications/` (in-app notifications + live Server-Sent Events stream — `index.js` is the ONLY import, same rule as email/ and ai/; `messages.js` one builder per `NotificationType`; `hub.js` the in-process stream registry; `notify(userIDs, messages.x(...))` is awaited after the DB commit but never throws — see Notifications below) · `config/prisma.js` sets `transactionOptions` 10s maxWait / 15s timeout on the client (Prisma's 2s/5s defaults failed requests over the remote Supabase link — batch `$transaction([...])` included, since the PrismaPg adapter runs those as real transactions).

**Infra:** $0 by design — Vercel Hobby (FE) · Render free web service (BE, `render.yaml`) · Supabase free (DB + storage) · Docker Compose (local rehearsal of production) — see Deployment below · branches `main` → `dev` → `feature/*`.
**Testing:** Jest + Supertest (server unit + integration; unit run gated at 80% lines / 70% branches) · Vitest + React Testing Library (client logic + a few critical components) · Cypress (critical adoption flows only) · GitHub Actions CI on every PR into `dev`/`main`. Details in **Testing** below.

---

## ⚠️ Permanent Known Issues

- **PostGIS migration drift (CRITICAL) — never run `npx prisma migrate dev`.** Prisma can't model the PostGIS `shelterLocation` column or the generated reference-code columns, so `migrate dev` sees them as drift and offers to reset the DB. `migrate deploy` is safe. The single baseline migration (`server/src/prisma/migrations/20261021120000_baseline/`) builds the whole schema, those columns and the partial/expression unique indexes included, so a fresh DB only needs `npm run setup` from `server/` (migrate deploy → generate → `setup/setup-storage.js` for the storage buckets + seed photos → seed; first-time only, since the seed wipes). For any schema change: edit `schema.prisma` → write the SQL as a **new** migration folder `migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql` (draft it with `npx prisma migrate diff --from-config-datasource --to-schema src/prisma/schema.prisma --script`, deleting the generated-code `DROP DEFAULT` noise and the `DROP INDEX "Shelter_shelterLocation_idx"` line — that's the PostGIS spatial index Prisma can't see, and `/shelters/nearby` depends on it) → `npx prisma migrate deploy` → `npx prisma generate`. Never edit an applied migration, and never apply schema SQL by hand only — a fresh setup would miss it. That baseline (Sprint 12) folds the first baseline and the 15 migrations after it into one — verified on a scratch PostGIS DB to build an identical schema; their data-only backfills were dropped, since a fresh DB has nothing to fix. The `…_<name>` migrations cited elsewhere in this file are those folded ones: the history, now part of the baseline.
  Seed uses `prisma.$executeRaw` for PostGIS values — intentional. **The seed wipes every table first** (deterministic IDs/data) and covers every enum value — keep it that way when adding statuses. Seed pet photos live in `setup/pet-images/<petname>.webp` (uploaded to `pet-images/seed/`); a new seeded pet needs its photo added there. `setup/placeholder.jpg` → `pet-images/placeholder.jpg` is what every app-created pet shows until a real photo is uploaded (`PLACEHOLDER_PHOTO` in `staff/pets.service.js`). Seeded ID verifications point at `setup/government-ids/*.png` (fake, SAMPLE-watermarked; uploaded to the private `government-ids/seed/`).
- **`CHAR(n)` padding:** right-pads with spaces, breaking strict string compares. Use `VARCHAR` unless the declared length exactly matches content width (`*Sex CHAR(1)` are safe; `petSex` was fixed `CHAR(2)`→`CHAR(1)`). Check on every new fixed-length column.
- **TanStack `queryKey` must include everything `queryFn` reads** — not just the state that looks like "the input". A computed override driven by other state silently breaks refetching if it's not in the key.
- **Age filter:** `petDOB` → `buildAgeFilter(minAge, maxAge)`. `minAge` = direct `lte`; `maxAge` = shift the cutoff back one month **and** use strict `gt` (not `gte`). Both parts required together.

---

## Authentication (Sprint 1 ✅)

Two-token: **access** (Zustand memory, 15 min, `Authorization: Bearer` on every protected call) + **refresh** (httpOnly cookie, 7 days, only issues new access tokens). Central `USERS` table (`userID` PK/FK shared by all six role tables) holds `userEmail`, `userPassword` (hashed), `role`, `refreshToken` (hashed), `emailVerified`.

**Session restore:** `App.tsx` calls `POST /auth/refresh-token` (cookie) on every load; success populates Zustand incl. the name from the role table and `emailVerified`, failure → public pages only. **An open dashboard stays signed in** for the refresh token's 7 days (Sprint 10): the notification stream ends at the access token's expiry, and `useNotificationStream` renews it with the refresh cookie (`setToken` on the auth store) and reconnects; a failed renewal ends the session like a 401.

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `POST /auth/register` | — | `USERS` + role row atomically via `$transaction` |
| `POST /auth/login` | — | access token + httpOnly cookie; name from role table |
| `POST /auth/logout` | Bearer | nulls `USERS.refreshToken`, clears cookie |
| `POST /auth/refresh-token` | cookie only | — |
| `POST` / `PATCH /auth/email-verification` | Bearer (`allowPending`) / — | resend a link (409 already verified, 429 within a minute) / redeem `{ token }` |
| `POST` / `PATCH /auth/password-reset` | — | `{ email }` → always the same 200 (no enumeration; nothing sent to Banned/Declined) / `{ token, password }` → every session signed out, email verified, returns `{ role }` |
| `PATCH /auth/password` | Bearer (`allowPending`) | `{ currentPassword, newPassword }` — 401 `wrong_password`; this session re-issued, others signed out |
| `POST` / `PATCH /auth/reactivation` | — | `{ email }` → always 200, link only for a **Closed** account / `{ token }` → Adopter/Donor Active, workers Pending; returns `{ role, accountStatus }` |
| `POST` / `PATCH /auth/email-change` | Bearer / — | `{ newEmail, currentPassword }` → link to the NEW address, heads-up to the old (409 `email_taken`, 429) / `{ token }` → login email changed and verified |

Login and refresh return `emailVerified` for every role. Login refuses Closed (`error.details.reason = "account_closed"` — the page offers a reactivation link) and Declined (`"account_declined"`) after a correct password; Deactivated and Banned keep their own messages. Passwords on register, reset and change must meet the same five rules (`server/src/utils/password.js` ↔ `client/src/logic/utils/password.ts`) — 422 with `error.details.unmet` otherwise. Every emailed-link flow is in **Email & Account Security** below.

**Guards:** FE `ProtectedRoute` (→ `/login?redirect=<path+search>` if no token, or the worker login for worker dashboards — see below), `RoleRoute` (→ `/forbidden` if wrong role). BE `authenticate.js` (verifies Bearer, sets `req.user`), `authorizeRoles('Staff','Admin')` factory.

**Staff onboarding before approval (Sprint 5.2):** new staff sign up Pending and onboard *before* they're approved (wizard: 2 Personal, 3 Address, 4 Identity/government ID, 5 Review; mandatory, no skip). Pending **Staff**, **Veterinarians** and **Volunteers** can log in (Pending Admin still can't) — the role list is `PENDING_LOGIN_ROLES` in `services/auth/pendingRoles.js`, shared by login and the middleware; login/refresh return `onboardingComplete`, `onboardingStep` (every role but Admin) and `accountStatus` (Staff + Vet + Volunteer). Plain `authenticate` still rejects Pending on every route — only routes wired with **`authenticate.allowPending`** admit a Pending staff member, vet or volunteer: `GET/PUT /staff/me`, `GET/POST /staff/me/government-id`, `PATCH /staff/me/onboarding-step` + `/onboarding-complete`, the same set under `/vets/me` (`routes/vet/vets.routes.js` — vet self-service, mirroring `/staff/me`'s shapes and status codes) and under `/volunteers/me` (`routes/volunteer/volunteers.routes.js`, mounted in `app.js` **before** the staff volunteers router so `GET /volunteers/:id` can't catch `/volunteers/me`), `POST /auth/logout`, `POST /auth/email-verification` and `PATCH /auth/password`. Keep that list minimal. **Approval** (Manager `PATCH /staff/me/team/:id/status` and `PATCH /staff/me/vets/:id/status`; Admin `PATCH /staff/:id/status` for Manager sign-ups; any staff member at the shelter `PATCH /volunteers/:id/status`) requires onboarding complete **and** a Verified government ID — enforced in `services/staff/staffApproval.service.js` (409 otherwise; every export takes the `userType`: `Staff`, `Veterinarian` or `Volunteer`), which also adds `governmentIdStatus` to the approvers' staff, vet and volunteer roster shapes. Declining (→ `Declined`, a final status — see Email & Account Security) is allowed at any stage. Existing staff, and every non-Pending vet and volunteer, were backfilled as onboarded (migrations `…_staff_onboarding_backfill`, `…_vet_onboarding_backfill`, `…_volunteer_onboarding_backfill`).

**Post-login redirect (Sprint 3):** `/login?redirect=/adopt/apply/5` — a query param (survives a mid-login refresh), URL-encoded. Any guarded route can send one — `ProtectedRoute` builds it from `location.pathname + location.search` for every protected page, and the adopt-apply flow's own navigates (`PetDetailsModal`, `AdoptApply`) set it explicitly. Login is mostly role-agnostic about it: redirect present → go there, else → role-dashboard default (`resolveDestination` in `logic/route/`, which also owns the role → dashboard map — Veterinarian is `/vet`). One exception: a redirect into *another* role's dashboard (e.g. `/staff/...` after logging in as Admin) falls back to the user's own dashboard, since it could only end at `/forbidden`. Ending a session from the UI (Log out, closing your own account) must go through **`useEndSession`** (`logic/hooks/`), which navigates away and clears the session inside one `flushSync` — calling `navigate()` then `logout()` separately isn't enough, since the Zustand update can re-render before the router applies the navigation, and `ProtectedRoute` then captures the current page as a stale `redirect`. Where a session ends up is by role (`logoutDestinationFor` / `loginPathFor` in `resolveDestination.ts`): workers (Admin, Staff, Veterinarian) go to the worker login `/staff-portal/login` after Log out or a 401; everyone else goes home (`/`) on Log out and to `/login` on a 401. `ProtectedRoute` likewise sends a signed-out visitor on a worker dashboard (`/staff`, `/admin`, `/vet`) to the worker login, keeping `?redirect=` (`loginPathForPage`). The same branch handles post-login and an already-authed user hitting `/login` directly. Otherwise role correctness is the *destination's* job, not Login's — `RoleRoute` bounces a mismatched role to `/forbidden`, and `AdoptApply` (which bypasses `RoleRoute`) re-checks role itself → `/adopt` + toast.

---

## Folder Structure

```
client/src/
  logic/
    api/         axiosInstance, authApi, petsApi, adoptersApi, adoptionApplicationsApi, visitsApi, vetsApi (/vets/me/*, POST /pets/:id/health-records), vaccinationsApi (/vaccines catalogue + appointment doses), donorsApi (/donors/me/*, /donations/checkout), volunteersApi (/volunteers/me self-service) vs shelterVolunteersApi (staff's /volunteers), selfGovernmentIdApi (per-role /me/government-id calls), notificationsApi (list/count/mark + `openNotificationStream`, a fetch-streaming SSE reader — EventSource can't send the Bearer header)
    route/       ProtectedRoute, RoleRoute
    store/       useAuthStore (Zustand: { user, token, role }) · useMatchesPopupStore (AI matches popup open/retake)
    hooks/       useEndSession · useResendVerification (every Verify/Resend button: toasts, 409 already-verified → session catches up, 429 wait) · useNotificationStream (mounted once in the shared DashboardLayout)
    notifications/ notificationKeys (everything under ["notifications"]) · notificationSound (new-notification chime)
    utils/       … password.ts (the five password rules, mirrors server utils/password.js)
    toast/       shared toast helpers
    adopter/     adopter-domain view helpers (applicationStatus.ts)
    geocoding/   (empty — server-side only)
  static/        assets/images/branding/ · content/ (CMS-ready page copy, one file/folder per page)
  components/
    ui/          generic primitives (Card, ButtonElement, Avatar, Modal + ModalActions, ConfirmActionModal, Phone*, SegmentedControl, PasswordRequirements)
      marketing/ SectionContainer, SectionHeading[Center]
      pets/      PetCatalogCard, PetDetailsModal, FilterControls
      dashboard/ DashboardHeading, DashboardWidgetHeader, DashboardList, StatTile, EmailVerificationBanner
      profile/   EmailVerificationStatus (Verify button takes onVerify/pending — no API import), ProfileAddressSection
      onboarding/ OnboardingProgress, OnboardingStepHeader, OnboardingStepNav, PersonalFields, AddressFields (shared by every role's wizard)
    layout/      Navbar, Footer, PublicLayout, DashboardNavbar, DashboardSidebar
  pages/
    public/      home/ · adopt/ (PetCatalog.tsx owns filter state; PetFilterBar, ShelterLocationFilter) · about/ · volunteer-info/
                 auth/  Login, WorkerLogin, Register, WorkerRegister + the emailed-link pages VerifyEmail, ForgotPassword,
                        ResetPassword, Reactivate, ConfirmEmailChange; shared/ AuthCard (background + card + field classes), ReactivationOffer
    errors/      Forbidden, NotFound
    protected/adopter/
      apply/       AdoptApply, AdoptApplyConfirmation   (the /adopt/apply/* funnel)
      onboarding/  OnboardingWizard + steps/
      shared/      GovernmentIdSection   (used by onboarding + Profile)
      dashboard/   DashboardLayout + DashboardRoutes + one file per tab
                   (Overview, Pets, Appointments, Favorites, Applications, Visits, Profile) + CloseAccountModal
        overview/  *Widget.tsx
        sections/matches/  MatchesLauncher, MatchesPopup, QuizFlow + QuizQuestion, MatchesList   (AI matcher)
        shared/    ApplicationsList, VisitsList, matchQuiz.ts (matcher query keys + topMatchesQuery)
    protected/shared/   used by 2+ roles: AccountSecuritySection (change password + email, on all six Profiles) · EmailUnverifiedNotice (adopt/donate soft gate) · AwaitingApproval (role prop — /staff/pending, /vet/pending, /volunteer/pending: Pending staff/vets/volunteers wait here once onboarded) · GovernmentIdSection (takes an `api` from logic/api/selfGovernmentIdApi.ts — staffGovernmentIdApi / vetGovernmentIdApi / volunteerGovernmentIdApi) · HealthPassport (role prop — /staff/pets/:petID/health-passport, /vet/health-records/:petID/health-passport; vet-only Add Record → AddHealthRecordModal) · PetsFilterBar (Species/Breed/Size/Age + optional Status — Staff Pets tab and vet Health Records) · idVerification/ · notifications/ (NotificationBell — navbar slot, NotificationItem, NotificationsPage — `/<role>/notifications` on all six dashboards, not in ROLE_NAV, useNotificationActions)
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
      dashboard/   DashboardRoutes (shared DashboardLayout; ROLE_NAV.Volunteer) + one file per tab (Overview, Tasks, Events, Appointments, Availability, Profile)
        overview/  StatsWidget + MyTasks/NextEvents/AppointmentsWidget; overviewQueries.ts (each query shared by its tile and widget)
        shared/    DateBlock, CloseAccountModal
    protected/donor/
      onboarding/  DonorOnboardingWizard + steps/   (2 Personal, 3 Address, 4 Review — skippable)
      dashboard/   DashboardRoutes (shared DashboardLayout; ROLE_NAV.Donor) + Overview, Donate, DonateConfirmation, History, Profile
        overview/  donorQueries.ts, StatsWidget, RecentDonationsWidget
        shared/    DonateForm, CloseAccountModal
  test/          setup.ts (jest-dom, cleanup, resets the auth store + localStorage) · render.tsx (renderWithProviders(ui, { route, user }) — fresh QueryClient, MemoryRouter, optional signed-in user)
  App.tsx        routes + session restore on mount

client/cypress/
  e2e/           one spec per critical flow (redirect-back, email-verification-gate, apply-and-withdraw, visit-confirmed-notification)
  support/       commands.ts (registerTestAdopter → { name, email, password, userID }, loginThroughForm) · e2e.ts (global after() → db:cleanUp)
  dbTasks.cjs    cy.task()s against server/.env's database (CommonJS; loaded by cypress.config.ts via createRequire)

server/src/
  routes/ controllers/ services/   grouped auth/ public/ adopter/ staff/ admin/ vet/ volunteer/ donor/ webhooks/ — one <domain>.<layer>.js per file
  middleware/   authenticate, authorizeRoles, errorHandler, upload
  services/geocoding/   index.js is the ONLY import; usPostalCodeGeocoder.js the only US-aware file
  services/storage/     index.js is the ONLY import (Supabase Storage)
  services/ai/          index.js is the ONLY import; openAiCompatible.js the only file that talks to the provider
  services/email/       index.js is the ONLY import (sendEmail, queueEmail, templates); brevoApi.js the only file that talks to the provider; templates.js one function per email
  services/notifications/ index.js is the ONLY import (notify, notifyAfterLookup, messages, recipient lookups, the inbox + stream); messages.js one builder per type; hub.js / inbox.js / stream.js behind it
  services/auth/        … accountTokens.service (issue/consume emailed-link tokens), emailVerification / passwords / reactivation / emailChange services, accountNotices (close/approve/decline/deactivate/ban/restore emails), userContact (email + name + status for any role)
  config/email.js       token lifetimes, resend cooldown, provider timeout
  config/notifications.js   read-notification retention, page sizes, stream heartbeat
  config/cors.js        allowed origins: CORS_ORIGINS, else CLIENT_URL, else localhost:3000
  config/matchScoring.js · matchQuiz.js · passportSummary.js   every matcher/summary knob (weights, quiz, AI call sizes)
  services/governmentIds/selfGovernmentId.service.js   every role's GET/POST /<role>/me/government-id (keyed by userType) — add new roles to its OWNERS map, don't copy it
  utils/        errors.js, response.js
  config/prisma.js   singleton Prisma client (PrismaPg adapter)
  prisma/       schema.prisma, seed.js
  tests/        setup/noAiProvider.js + noEmailProvider.js (jest setupFiles — blank AI_* / EMAIL_* so no test can reach either provider; suites that assert on AI or email mock services/ai / services/email) · unit/<role>/ (Prisma fully mocked) · integration/<role>/ (live DB; journey files sprint3Journeys, adminJourneys, sprint5_1Journeys, sprint5_2Journeys, staffOnboarding.journey, vet/sprint6Journeys, volunteer/sprint7Journeys, adopter/sprint8Journeys — fakes services/ai via jest.mock, auth/sprint9Journeys — captures emails via a mocked services/email and follows their links, notifications/sprint10Journeys — reads each recipient's inbox, and a live stream over `app.listen(0)`) · unit/notifications/ (notificationsMock.js is the shared `jest.mock` target for suites that assert which notifications a service sends) · integration/helpers/ (testData.js — the cleanup tracker; leftovers.js — `npm run test:leftovers`)
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

Base: `http://localhost:5000/api/v1` (dev) · `https://petpals-api.onrender.com/api/v1` (prod API; the site itself calls `/api/v1` through Vercel's rewrite). Everything under `/api/v1/`.

**Conventions:** plural nouns · kebab-case multi-word (`/adoption-applications`) · no verbs in URLs · one nesting level (`/pets/:id/photos`) · query params for filter/sort/paginate · `PATCH /<resource>/:id/status` for status changes.

**Response envelope:**
```json
{ "success": true,  "message": "...", "data": {…|[…]}, "pagination"?: { "page", "limit", "total", "totalPages" } }
{ "success": false, "message": "...", "error": { "code": "NOT_FOUND", "details": "..." } }
```
`GET /pets/featured` returns a bare array (no envelope pagination).

**Error codes:** `BAD_REQUEST` 400 · `UNAUTHORIZED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `VALIDATION_ERROR` 422 · `TOO_MANY_REQUESTS` 429 (asking for another emailed link within a minute) · `INTERNAL_SERVER_ERROR` 500 · `SERVICE_UNAVAILABLE` 503 (an upstream — the AI provider — failed; retryable).

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
| PATCH | `/visits/:id` | `{ visitStatus }` — adopter: `Cancelled` only, own future non-closed visits. Staff/Admin: unconfirmed → `Confirmed` → `Completed`, or `Cancelled` on the adopter's terms (future, not closed); Staff only at their shelter (403) |
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

### Volunteer portal (Sprint 7 ✅)

All Volunteer-only. Volunteers sign up at a shelter (Pending) and onboard before staff approve them — see Staff onboarding above for `allowPending` and the approval gate.

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET / PUT | `/volunteers/me` | profile (incl. shelter contact, decoded `availability`); `allowPending`. PUT partial; shelterID/accountStatus → 400; phone → E.164 (422 if unparseable) |
| PUT | `/volunteers/me/availability` | whole week `{ availability: { Mon: ["Morning","Afternoon"] } }`; `{}` clears; unknown day/slot → 400. Stored compactly in `volunteerSchedule` (`"Mon:MA;Wed:E"`, `utils/availability.js`); older free text decodes to `availability: null` (client shows the raw text) |
| GET / POST | `/volunteers/me/government-id` | shared `selfGovernmentId.service.js`; `allowPending` |
| PATCH | `/volunteers/me/onboarding-step` · `/onboarding-complete` | 2–5, same wizard as staff/vets; complete needs a submitted ID (409 naming what's missing) |
| GET | `/volunteers/me/tasks` | tasks they're assigned to; `taskStatus`, `upcoming` (on `taskDue`), page/limit; staff Task shape incl. derived Overdue |
| PATCH | `/volunteers/me/tasks/:id/status` | `{ taskStatus: "Completed" }` only (cancel is staff's); not theirs → 404; not In_progress → 409 |
| GET | `/volunteers/me/events` | **read-only** — every event at their shelter + `assigned` (only their own assignment). `upcoming`, `assigned`, `dateTo` (inclusive), page/limit. No self sign-up: staff assign via POST/PUT `/events` `volunteerIDs`; `/volunteers/me/events/:id/signup` doesn't exist (404) |
| GET | `/volunteers/me/appointments` | appointments they assist (`Appointment.volunteerID`); same item shape/labels/split as `/vets/me/appointments` |
| DELETE | `/volunteers/me` | `{ mode: deactivate|delete }`. 409 (either mode) while assisting an upcoming Scheduled appointment or holding an In_progress task — `error.details.blockers` = `["appointments","tasks"]` (whichever apply). Either mode drops their future event assignments; delete also removes their task/event assignment rows, the ID + file, Volunteer + Users rows (`Appointment.volunteerID` → null) |

Staff side: `GET /volunteers` roster rows carry `onboardingComplete` + `governmentIdStatus`; `GET /volunteers/:id` masks `idNumber` and returns decoded `availability`; `PATCH /volunteers/:id/status` (any staff at the shelter) is the approval.

### Donor portal (Sprint 7 ✅)

All Donor-only, plain `authenticate` (donors are Active from sign-up — no Pending state, no government ID). Never exposes the Stripe IDs (`stripeCustomerID`, `stripeCheckoutSessionID`, `stripePaymentIntentID`).

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET / PUT | `/donors/me` | profile; PUT partial; accountStatus/stripeCustomerID → 400 |
| PATCH | `/donors/me/onboarding-step` · `/onboarding-complete` | 2–4 (Personal, Address, Review); skippable client-side |
| POST | `/donations/checkout` | `{ shelterID, amount (whole USD 1–10000, config/fees.js), donationDesc? ≤300 }` → `{ checkoutUrl }`. Closed shelter → 409 (Open and Full accept); unknown → 404. No row here — the Stripe webhook (`metadata.kind = "donation"` → `finalizeDonation`) records it with Stripe's `amount_total`; a replay is ignored (unique session ID). success → `/donor/donate/confirmation?session_id=…`, cancel → `/donor/donate` |
| GET | `/donors/me/donations` | history newest first — `shelterID`, `dateFrom` (incl.), `dateTo` (excl.), page/limit. With `?checkoutSessionId=` it's the confirmation poll instead: that donation, or `null` (200) until the webhook lands |
| GET | `/donors/me/donations/stats` | `?yearStart=` (required — client's local start of year): totalAmount, donationCount, thisYearAmount, byShelter (largest first) |
| GET | `/donors/me/donations/:id` | own only; another donor's → 404 |
| DELETE | `/donors/me` | `{ mode: deactivate|delete }`; never blocked. Donations survive with `donorID` null (staff see "Former donor") |

Public: `GET /shelters?acceptingDonations=true` lists Open + Full shelters (the Donate picker); without it, Open only.

### AI matcher + passport summary (Sprint 8 ✅)

Matcher endpoints are Adopter-only. AI is optional throughout — see AI Matcher below for the fallbacks.

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | `/match-quiz/questions` | served as-is from `config/matchQuiz.js`; options ordered most → least on the trait; answers saved by option `code` |
| GET / PUT | `/adopters/me/quiz` | GET → `{ answers, updatedAt }` or `null` (answers no longer in the config dropped). PUT `{ answers }` — the **whole** set; unknown question/option, missing question or non-object → 400. Saving clears the adopter's `AdopterMatch` rows in the same `$transaction` |
| GET | `/adopters/me/matches` | `limit` 1–20 (default 3; 400 otherwise). No quiz → `{ quizComplete: false, matches: [] }` (200, computes nothing). Else PetCard shape + `score` (totalScore), `reason` (null unless AI-scored), `aiExplained`. Excluded at read time, not in the cache: pets no longer `available` and pets the adopter has a Pending/Accepted application for |
| GET | `/pets/:id/health-passport/summary` | Staff/Veterinarian/Admin, same access as the passport (Staff elsewhere → 403, vet elsewhere → 404). AI not configured → `{ aiAvailable: false, summary: null, pointsToReview: [] }`. Empty passport → fixed summary, no AI call. AI failure → 503 `SERVICE_UNAVAILABLE` ("try again shortly"), not cached. Points: `{ text, source: { type: healthRecord\|vaccination\|transfer, recordID }, origin: rules\|ai }` |

The passport payloads (`/staff/me/pets/:id/health-passport`, `/vets/me/pets/:id/health-passport`) carry `aiSummaryAvailable` (= `isAiConfigured()`, no AI call) so the client can enable the button.

### Notifications (Sprint 10 ✅)

Every role, plain `authenticate` (a Pending user has no dashboard yet). Each query is scoped to the caller — another user's notification answers exactly like a missing one.

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | `/notifications` | newest first; `unread` (`true`/`false`, 400 otherwise), `page`, `limit` (default 20, max 50). `unreadCount` (the caller's total, whatever the filter) sits top-level beside `pagination` — an envelope extension. First deletes the caller's notifications read more than 90 days ago (lazy, no cron); unread ones are never deleted |
| GET | `/notifications/unread-count` | `{ unreadCount }` |
| PATCH | `/notifications/:id` | `{ read: true\|false }` → `{ notification, unreadCount }`; re-marking read keeps the first `readAt` |
| PATCH | `/notifications` | `{ read: true }` only (mark all read) → `{ updated, unreadCount: 0 }` |
| GET | `/notifications/stream` | Server-Sent Events: `unread-count` `{ unreadCount }` on connect and after any mark-read (so every tab agrees), `notification` `<item>` for each new row, `token-expired` `{}` right before the server ends the stream at the access token's `exp`; a `: heartbeat` comment every 25s. Auth via the Bearer header (`req.tokenExpiresAt` set by `authenticate`) |
| POST | `/shelters/:id/capacity-alerts` | Admin — the Overview's Notify Manager. Sends the shelter's manager a CapacityAlert → 201 `{ managerID, managerName }`; no Active manager → 409; unknown shelter → 404. Sending *is* the request, so a failed insert → 500 (unlike every other hook) |

Item shape (REST and stream alike): the row minus `userID` — `notificationID`, `type`, `title`, `body`, `link`, `readAt`, `createdAt`.

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

**Health passport** (`protected/shared/HealthPassport.tsx`) is one component for Staff and Vet. Read-only for Staff; a vet also gets **Add Record** (`POST /pets/:id/health-records`). Doses are only recorded against an appointment (no standalone dose endpoint), so the passport has no Record Vaccination button. **Summarize with AI** (both roles; disabled with a tooltip when `aiSummaryAvailable` is false) opens `protected/shared/PassportSummaryPanel.tsx`: the summary plus Points to review, each linking to the record, dose or transfer it cites (scrolls the passport to that row and highlights it). Mounted only while open, so the first click fetches; its query sits under the passport's key, so Add Record invalidates both. Editing a vet's own notes isn't wired in the UI — the passport payload doesn't carry the author's `vetID` yet.


---

## Volunteer Portal (Sprint 7 ✅)

Onboarding is the staff/vet wizard (`/volunteer/onboarding/step/:step`, mandatory), then the shared `AwaitingApproval` (`/volunteer/pending`) until any staff member at their shelter approves. Volunteers aren't workers: public `/login`, Log out / close account → `/`. Tabs under `/volunteer/*` (Profile is reached from the sidebar account menu, never `ROLE_NAV`):

- **Overview** — tiles (Active Tasks, Upcoming Events, Upcoming Appointments, Events Served) + My Tasks, My Next Events, Assisting Appointments, Shelter Details (`protected/shared/ShelterDetailsWidget`, shared with the vet Overview). Each tile reads `pagination.total` from its widget's query (`overview/overviewQueries.ts`); keys under `["volunteer","tasks"|"events"|"appointments"]`.
- **My Tasks** — Status + Due Date filters; **Mark Completed** through `DashboardActionList` (confirm modal), invalidating `["volunteer","tasks"]` so the Overview updates. Volunteer-facing labels in `logic/volunteer/taskStatus.ts` (In_progress reads "Open").
- **Events** — read-only, vet-Appointments layout: Upcoming card (Status all/assigned + Event Date → `dateTo`) and Past card (events they were on). "Assigned to you" badge instead of a Sign up button.
- **Appointments** — read-only Upcoming/Past cards.
- **Availability** — `components/ui/AvailabilityGrid` (also read-only on staff's volunteer detail; slot hours `AVAILABILITY_SLOT_HOURS` in `logic/utils/availability.ts`), local draft until Save → `PUT /volunteers/me/availability`.
- **Profile** — vet Profile layout with `GovernmentIdSection`; `shared/CloseAccountModal` turns the 409's `blockers` into its own panel with View tasks / View appointments.

## Donor Portal (Sprint 7 ✅)

Onboarding is skippable (`/donor/onboarding/step/:step`; `OnboardingGate`'s `SKIPPABLE_ROLE_PATHS` — Adopter keeps `/adopt/apply` gated, Donor gates nothing once skipped). Tabs under `/donor/*`:

- **Overview** — tiles (Total Donated, This Year, Donations Made, Shelters Supported) from the stats query, the donate form, Recent Donations. Every donation query sits under `["donor","donations"]` (`overview/donorQueries.ts`).
- **Donate** — `shared/DonateForm` (also on the Overview): shelter picker (`GET /shelters?acceptingDonations=true`), $25/$50/$100/$200/custom whole dollars, optional message → `POST /donations/checkout` → `window.location.href` to Stripe.
- **DonateConfirmation** (`/donor/donate/confirmation`, Stripe's success_url) — polls `?checkoutSessionId=` every 2s (30s then "Still processing"), same approach as `AdoptApplyConfirmation`; once found, invalidates `["donor","donations"]`.
- **Donation History** — Shelter (from the stats' `byShelter`) + Date range filters (client-computed `dateFrom`/`dateTo`), rows with `donationCode`, plus a By Shelter totals card.
- **Profile** — vet/volunteer Profile layout minus the government ID; `shared/CloseAccountModal` (no 409 case).

## AI Matcher (Sprint 8 ✅)

**Rule scorer** (`services/adopter/matchScore.js`, pure, no Prisma/AI; knobs in `config/matchScoring.js`). Hard filters drop a pet outright: not `available`; adopter has children/pets and it isn't compatible; special needs the adopter isn't open to (only facts the adopter gave count). Six factors, each 0–1, weighted to 0–100: size 20, age 15, breed 15, home 20, experience 15, activity 15 (profile `activityLevel` averaged with the quiz's exercise answer); a blank adopter field scores neutral 0.5. Top 20 (`SHORTLIST_SIZE`) go on; ties → earliest `intakeDate`, then lower `petID`.

**AI step** (`services/adopter/matches.service.js`). Only with AI configured, a saved quiz and a non-empty shortlist: **one** `generateStructured` call for the whole shortlist (`AI_MATCH_CALL`: low reasoning effort, 2000-token cap) with the quiz answers' wording + each pet's species/age/size/`petDesc` — no adopter personal data; `petDesc` is treated as data, never instructions. The reply is re-checked (unknown/repeated pet IDs dropped, scores clamped 0–100, reasons cut to 300). `totalScore = round(0.6 × rule + 0.4 × AI)`; a pet the AI didn't score keeps its rule score. Any AI error (`err.reason`) → rule scores for every pet, logged (auth_failed as an error, the rest as warnings); non-AI errors rethrow.

**AdopterMatch cache.** A recompute replaces the adopter's rows in one `$transaction` (`computedAt` = compute start). `getMatches` reads the cache and recomputes only when stale: no rows, or any `available` pet or cached pet has `Pet.updatedAt` > oldest `computedAt`. Quiz saves (`matchQuiz.service.js`) and profile PUTs touching `MATCH_PROFILE_FIELDS` (`adopters.service.js`) delete the rows, so they arrive as "nothing cached". Applying for a pet doesn't touch it, so the cache stays warm.

**PetHealthSummary cache** (`services/staff/healthPassportSummary.service.js`, knobs in `config/passportSummary.js`). One AI call per regeneration (`AI_SUMMARY_CALL`: low effort, 1500 tokens) over the newest 20 records, every dose and the newest 10 transfers — no people's names. Cached by `inputHash` = SHA-256 of the system prompt + the prompt data, so any record/dose/transfer change (or a reworded prompt) regenerates. Overdue-vaccine points always come from the rules (`utils/vaccinations.js`, worked out per request, `origin: "rules"`, skipped for adopted/deceased) — the AI is told not to judge due dates; its own points must cite a sent source. Seed caches a summary for Rocky via `getPassportInputHash`.

**Client** (`adopter/dashboard/sections/matches/`) — not an Overview widget. `MatchesLauncher` is a floating AI button bottom-right on every adopter dashboard page (mounted in `DashboardRoutes`, tooltip from the saved quiz) that toggles `MatchesPopup`, a non-modal panel: no quiz → `QuizFlow` (one `QuizQuestion` at a time, compact progress ring, retake prefilled; saving removes `["adopter","matches"]`), else `MatchesList` (top 3 — best match gold + "Best match" tag, "why this match", Know More → `PetDetailsModal` owned by the launcher; one note when every score is rule-only) with Take the quiz again. Open/retake state is `useMatchesPopupStore`, so Profile's `MatchQuizCard` (Take the quiz / Retake quiz) opens the same popup; the popup mounts on first open (the matches query, which can run the AI, never fires until wanted) and is then only hidden, keeping a half-done quiz; the launcher resets the store on unmount (logout). Query keys in `dashboard/shared/matchQuiz.ts`.


## Email & Account Security (Sprint 9 ✅)

**Sending.** Everything goes through `services/email/` (see Tech Stack). Callers build a message with a `templates.*` function (one per email; `{ subject, text, html }`, HTML escaped, links from `CLIENT_URL` via `clientLink`) and hand it to `queueEmail` **after** their write commits — never awaited, never fails the request. Dev with no key: the email (and its link) prints to the server console. Real mail: a Brevo API key + verified sender (`setup/SETUP.md` → Email).

**Account statuses.** One `accountStatus` column per role table, values with fixed meanings (migration `…_account_status_closed_declined`):
- **Closed** — the owner closed it (`DELETE /<role>/me` mode `deactivate`, every role). The only status its owner can undo, by an emailed reactivation link; nobody else can change it (409).
- **Declined** — turned down at approval (Staff, Veterinarian, Volunteer, Admin). Final: can't be approved later.
- **Deactivated** — done by an admin/staff member; only they can restore it. **Banned** — Adopter, Donor, Volunteer.
- Transitions others may make: Pending → Active / Declined; Active → Deactivated; Deactivated → Active (admin endpoints); adopter Active/Banned/Deactivated among themselves. Anything else 409. `utils/staffDates.js`: Closed stamps `staffDOS` like Deactivated; Declined stamps nothing.

**Emailed links** (`AccountToken`, migration `…_account_tokens`). `accountTokens.service.js`: `issueToken(userID, purpose)` stores only the SHA-256 of a random token (the raw token exists only in the email), deletes the user's earlier unused tokens of that purpose (only the newest link works) and enforces a 60s cooldown → 429; `consumeToken` is single-use inside the caller's `$transaction` → 400 with `error.details.reason` `token_invalid` / `token_expired` / `token_used`. Lifetimes in `config/email.js`: verification 24h, reset 1h, reactivation 24h, email change 24h. Opening any link proves the address, so reset, reactivation and email change also set `emailVerified`.

**Soft verification gate.** Everyone can log in unverified (dashboard banner). Only `POST /adoption-applications` and `POST /donations/checkout` need a verified email → 409 `CONFLICT`, `details.reason = "email_unverified"` (not 403 — axios sends every 403 to `/forbidden`), checked before any pet/shelter lookup or Stripe call. Register sends the first link; existing accounts were backfilled verified.

**Notices** (all after commit, failures logged): `services/auth/accountNotices.js` — closed / deleted (own `DELETE /<role>/me`, contact read before the delete) and, for changes someone else makes on the six status endpoints, approved (Pending → Active), declined, deactivated, banned, restored (→ Active from Deactivated/Banned); `services/staff/reviewNotices.js` — government ID Verified / Rejected, adoption application Accepted / Rejected incl. the ones declined automatically when another is accepted (found with a `findMany` inside the same transaction). Plus password changed, email-change requested (to the old address) and email changed. Not emailed: application received, visits, tasks/events, appointments, donation receipts, reminders.

**Client.** `AuthUser.emailVerified` drives the `EmailVerificationBanner` (top of `<main>` in the shared `DashboardLayout`) and `EmailUnverifiedNotice` (replaces the submit button in `AdoptApply` and `DonateForm`; a 409 `email_unverified` flips the session too). Link pages under `pages/public/auth/`: `/verify-email`, `/reset-password`, `/reactivate`, `/confirm-email-change` redeem `?token=` once on mount (ref guard for StrictMode) — except reset, which needs the new password first; `/forgot-password` (`?portal=staff` keeps the worker look). All five are in `OnboardingGate`'s `LINK_PAGES`, so a mid-onboarding or Pending user isn't redirected away before the token is used — **add any new link page there**. Login/WorkerLogin: "Forgot password?" and, on `account_closed`, `ReactivationOffer`. Every Profile: `AccountSecuritySection` above the Danger zone. After a verify or email change in a signed-in tab: `updateUser(...)` + `queryClient.invalidateQueries()`.

**Seed** covers every status per role (`*.closed@`, `*.declined@`), an unverified adopter and donor (`adopter.unverified@`, `donor.unverified@`) and one spent token per purpose — seeded emails are fake `@petpals.com` addresses, so never act on them with a real Brevo key set.

---

## Notifications (Sprint 10 ✅)

**Model.** The database is the record; the stream only nudges. `notify()` stores one row per recipient (nulls and repeats dropped, text clipped to the columns), then pushes each row to its owner's open streams via `hub.publish`. It's called by services **after** their write commits, awaited, never throws (logged) — same rule as `queueEmail`. `notifyAfterLookup(context, prepare)` wraps a hook whose recipients or text need a lookup first. Recipient helpers (index.js) return Active accounts only: `shelterStaffIDs`, `shelterManagerID`, `activeAdminIDs`, `acceptedAdopterForPet`, `signupApproverIDs(kind, shelterID)` (Volunteer → shelter staff, Staff/Veterinarian → manager, Manager → admins). Nobody is told about their own action. The hub is in-memory — fine for one Render instance; scaling out means Postgres LISTEN/NOTIFY behind the same `publish`.

**Text.** One builder per type in `messages.js` → `{ type, title, body, link }`; no dates or times in the text (the linked page shows them in the viewer's zone). `link` is a client path; a page that can open the item itself takes a query param (`/adopter/visits?visitID=` opens that visit — `Visits.tsx` watches the param, so it works when already on the page).

**Event catalogue** (`NotificationType`, PascalCase):
- **Adopter** — ApplicationSubmitted (the Stripe webhook created the row) · ApplicationApproved / ApplicationDeclined (staff decision; accepting also tells every auto-declined applicant, found by the `findMany` in the same transaction) · VisitConfirmed / VisitCancelled (staff on `PATCH /visits/:id`; Completed isn't news) · AppointmentScheduled / AppointmentChanged / AppointmentCancelled (to the adopter holding the pet's Accepted application; Changed = new date, reason or vet — a volunteer swap isn't) · GovernmentIdVerified / GovernmentIdRejected (any role with an ID; link → that role's Profile).
- **Shelter staff** — NewApplication, NewVisitRequest, ApplicationWithdrawn, VisitCancelledByAdopter (every Active staff member at the shelter) · SignupReadyForApproval (the approvers, when a Pending sign-up finishes onboarding — once) · TransferIncoming (the destination's assigned staff, or its whole team when none; also the new assignee on reassign) · TransferCompleted / TransferRejected (origin side) · TransferCancelled (destination side) · CapacityAlert (the manager, from the admin endpoint).
- **Veterinarian** — AppointmentAssigned · AppointmentChanged / AppointmentCancelled (a vet swap cancels for the old vet, assigns the new). `notifyAppointment({ before, after, actorID })` in `staff/appointments.service.js` covers adopter + vet + volunteer.
- **Volunteer** — TaskAssigned, EventAssigned (only volunteers newly added by the edit; the old set is read first, and a failed read skips the notice, not the edit) · EventCancelled (deleting a future event) · AppointmentAssistAssigned / AppointmentAssistCancelled.
- **Donor** — DonationReceived (the webhook recorded it; donation receipts aren't emailed).
- **Admin** — AdminSignupPending (a non-first admin registered).
Email stays for account/security; a few events (decisions, ID reviews) send both. Not notified in v1: favourites, matches, health records, preferences, digests.

**Client.** `useNotificationStream` (in the shared `DashboardLayout`, so it runs on every dashboard page and stops on logout) holds the stream open, sets `["notifications","unread-count"]` from `unread-count` events, bumps it on `notification` and invalidates the lists; every (re)connect invalidates everything, so anything missed while disconnected is refetched. Reconnect backoff 1s → 30s; `token-expired` (or a 401 at open) renews the token and reconnects (one retry after 1s — the refresh token rotates and two tabs can race; a 401 within 10s of a renewal ends the session). `NotificationBell` (navbar slot): unread badge (9+), latest 10 while open, mark one/all, View all → `NotificationsPage` (All/Unread, pagination, per-row read/unread). The adopter Overview's Notifications tile reads the same unread-count query. **Chime:** `notificationSound.ts` — Web Audio, no file or library; only for live `notification` events, never the reconnect backlog; one tab plays per notificationID (localStorage); unlocks on the first click/key (browser autoplay rule); on/off per browser via the speaker toggle in the bell dropdown, default on.

---

## Testing (Sprint 11 ✅)

| Layer | Where | Runs against | Command |
| --- | --- | --- | --- |
| Server unit | `server/src/tests/unit/` (80 suites, ~2,100 tests) | Prisma, Stripe, storage, AI, email all mocked | `npm run test:unit` (from `server/`, with coverage + the gate) |
| Server integration | `server/src/tests/integration/` (26 suites) | the real database in `server/.env` (the dev DB — no separate test project) | `npm run test:integration` (`--runInBand`), then `npm run test:leftovers` |
| Client unit/component | `client/src/**/*.test.{ts,tsx}` | jsdom, API modules mocked with `vi.mock` | `npm test` (from `client/`) · `test:watch` · `test:coverage` |
| End-to-end | `client/cypress/e2e/` | both dev servers + the dev DB | `npm run cypress:open` / `cypress:run` (from `client/`) |

`npm test` in `server/` still runs unit + integration together (`--runInBand`); `test:coverage` is the same with coverage.

**Coverage gate.** `server/jest.config.js` counts every `src/**/*.js` (minus `src/tests/**` and the seed), so an untested file shows as 0% instead of disappearing; `coverageThreshold` fails a `--coverage` run below 80% lines/statements/functions or 70% branches. Measured 2026-10-21: 95.1% lines / 86.3% branches (baseline before Sprint 11: 89.3 / 78.2). The client isn't gated — its tests cover logic and the few components that guard the adoption flow, not every page.

**Integration data — crash-proof cleanup.** Every suite records what it creates the moment it exists with the tracker from `integration/helpers/testData.js` (`const data = trackTestData(); data.user(id) / data.shelter(id) / data.species(id) / data.pet(id) …`) and calls `await data.cleanUp()` in `afterAll`. `cleanUp` removes dependants children-first, each step guarded so one failure can't stop the rest — rows are never found by name or email pattern. `npm run test:leftovers` is a read-only report of anything left (test logins `@ex.com`, their shelters, unseeded species/pets); delete leftovers only with the user's OK. Jest `testTimeout` is 90s (the remote Supabase link — a timed-out hook keeps running and races the cleanup).

**Client tests (Vitest).** Config in `vite.config.ts` (`test` block, jsdom, `src/test/setup.ts`). No globals — import `describe/test/expect/vi` from `vitest`. Logic first (`logic/**`), then components through `renderWithProviders`; mock the `logic/api/*` module, never axios. A suite needing Node APIs (streams) sets `// @vitest-environment node`. Client `lib` is ES2020 (no `Array.at`) and there's no `@types/node`.

**Cypress.** Specs create their own data: accounts through the API (`cy.registerTestAdopter()`, `cy.request`), and through `cy.task()` (`cypress/dbTasks.cjs`) only what the API can't do for a test — `db:availablePet` (Open shelter + own species + available pet → `{ petID, petName, shelterID, shelterName, speciesID }`), `db:verifyEmail`, `db:completeOnboarding` (the OnboardingGate blocks `/adopt/apply` and dashboards until it's done), `db:activateStaff`, `stripe:paidApplicationEvent` (a locally signed `checkout.session.completed` to POST to `/webhooks/stripe`; nothing is sent to Stripe). Everything is recorded with the integration tracker and removed by a global `after()` → `db:cleanUp`, even when a spec fails. Gotchas: `cy.request` shares the browser's cookies and the app restores a session from the refresh cookie on every page load — after logging a second user in through `cy.request`, `cy.clearAllCookies()` before the next `cy.visit`; pages keep hidden `role="dialog"` elements mounted, so find a modal by its title (`cy.contains('[role="dialog"]', "Withdraw application?")`); Stripe's hosted page is stubbed with `cy.intercept("GET", "https://checkout.stripe.com/**", …)` and the spec stops at the hand-off. The apply spec creates a real Stripe test-mode Checkout Session, so `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` must be set. `cypress/tsconfig.json` is type-checked by `npm run typecheck`.

**CI** (`.github/workflows/ci.yml`, Node 22) on every PR into `dev`/`main` and every push to them: **Server unit tests** (`npm ci`, `prisma generate`, `test:unit` — the gate; placeholder `JWT_SECRET`/`DATABASE_URL`, nothing connects) and **Client checks** (typecheck incl. Cypress, lint, Vitest). Both are required status checks. Integration and Cypress stay local — they need the database and running servers.

**Known flake (accepted).** About 1 server unit run in 20–30 fails one random test with `read ECONNRESET` (a Supertest connection dropped, macOS, Node 22); rerun. Investigated in Sprint 11, not fixed.

---


## Deployment (Sprint 12 — in progress)

**$0 by design** — every service on a free tier with no expiry; never a paid plan or a paid-only feature. Live: site `https://petpals-adopt.vercel.app` (Vercel project `petpals`; `petpals.vercel.app` belongs to someone else) · API `https://petpals-api.onrender.com` (Render Blueprint `petpals`). Both currently deploy `feature/sprint-12` — switch Vercel's production branch (Settings → Environments → Production → Branch Tracking) and the Render Blueprint's branch to `main` once the sprint PRs merge. Render env: `CLIENT_URL=https://petpals-adopt.vercel.app`, `CORS_ORIGINS` blank, `STRIPE_WEBHOOK_SECRET` = the production endpoint's own secret (not the `stripe listen` one).

- **Client — Vercel Hobby**, root `client/`. `client/vercel.json` rewrites `/api/:path*` → `https://petpals-api.onrender.com/api/:path*` (hard-coded — `vercel.json` can't read env), so REST and the refresh cookie stay first-party (`SameSite=strict` survives Safari), then falls back to `index.html` for every other path. Build env: `VITE_API_URL=/api/v1`, `VITE_STREAM_URL=https://petpals-api.onrender.com/api/v1` — the SSE stream goes straight to the API (Bearer header, no cookie) so no proxy can buffer it; `openNotificationStream` falls back to `VITE_API_URL` when it's blank. Both are declared in `vite-env.d.ts`; `client/.env.example` explains them.
- **API — Render free web service**, from the root `render.yaml` Blueprint: Docker (`server/Dockerfile`), region ohio (beside Supabase's us-east-2), healthcheck `GET /health` (root, not under `/api/v1`), start = `server/migrate-and-start.sh` (`prisma migrate deploy`, then `exec node src/index.js`; pre-deploy commands are paid, and Render keeps quotes in `dockerCommand` literally, so no `sh -c "… && …"` there), `JWT_SECRET` generated by Render, every other secret `sync: false`; the deploy branch is chosen in the dashboard. Free-tier limits: sleeps after 15 min without requests, ~30–60 s cold start; an open dashboard keeps it awake (the stream reconnects at every token renewal).
- **Rate limits** (`middleware/rateLimit.js`, numbers in `config/rateLimits.js`, in-memory — one instance): login (per email tried), register, emailed-link requests, token redemption + password change, the two AI endpoints (per user), and a per-IP backstop on `/api/v1`. Per-IP means `clientIp(req)` — `x-vercel-forwarded-for` (via the Vercel rewrite), else `cf-connecting-ip` (direct to Render), else `req.ip`; on Render `req.ip` is a rotating internal load balancer, so never key on it there. 429 `TOO_MANY_REQUESTS` with `details { reason: "rate_limited", retryAfterSeconds }`. `RATE_LIMITS=off` skips them all — Jest sets it (`tests/setup/noRateLimits.js`); set it in `server/.env` for repeated local Cypress runs, never on Render.
- **CORS** (`config/cors.js`): `CORS_ORIGINS` (comma list) else `CLIENT_URL` else `http://localhost:3000`. `CLIENT_URL` stays ONE origin — Stripe return URLs and emailed links are built from it. `app.set('trust proxy', 1)` for the host's HTTPS proxy.
- **Database — Supabase free.** `DATABASE_URL` must be the **Session pooler** URI (`aws-…pooler.supabase.com:5432`, user `postgres.<ref>`): the direct `db.<ref>.supabase.co` host is IPv6-only, which Docker containers and Render can't reach; session mode keeps migrations working (never the port-6543 transaction pooler). Production shares the dev project — never run `npm run setup` or the seed against it after launch (they wipe), and integration/Cypress runs briefly show test rows on the live site. A free project pauses after ~1 week idle.
- **Docker** — a local rehearsal of production: `docker compose up --build` runs the API (`env_file: server/.env`, healthcheck) and the client on nginx (`client/nginx.conf`: `/api` → `server:5000` like Vercel's rewrite, SPA fallback; build args `VITE_API_URL=/api/v1`, `VITE_STREAM_URL=http://localhost:5000/api/v1`). Node 22 Alpine images; `prisma` is a production dependency (the image runs `migrate deploy`); `.dockerignore` keeps every `.env` out of both images.

## Database Notes

- `Pet.petDOB` replaced static `petAge` (age computed at request time). `Pet.featuredFlag BOOLEAN DEFAULT FALSE` powers `/pets/featured` (set via SQL for now, staff toggle planned).
- Partial and expression unique indexes (not expressible in `schema.prisma`) live only in migration SQL — see Known Issues. Case-insensitive name uniqueness (migration `20260927060418_species_breed_name_ci_unique`): `LOWER(speciesName)` table-wide, `(speciesID, LOWER(breedName))` per species; `staff/species.service.js` pre-checks for a clean 409 and maps the index's violation (a race) to the same 409. Active-application uniqueness: `UNIQUE (adopterID, petID) WHERE applicationStatus IN ('Pending','Accepted')`. One Accepted application per pet: `UNIQUE (petID) WHERE applicationStatus = 'Accepted'` (migration `…_one_accepted_application_per_pet`) — accepting an application also declines the pet's other Pending ones with an automatic `staffRemark`, and accepting for a pet that's no longer `available` is a 409; the index stops two simultaneous acceptances. Double-submit guard on Appointment: `UNIQUE (petID, vetID, appointmentDate) WHERE appointmentStatus = 'Scheduled'` — same pet+vet+timestamp can't have two Scheduled rows (a resubmitted create after a perceived failure).
- Donation (migration `…_donation_stripe`): `stripeCheckoutSessionID` (UNIQUE — a replayed webhook can't record twice) and `stripePaymentIntentID`, both nullable for pre-Stripe rows; `donorID` nullable with `ON DELETE SET NULL` so a deleted donor's donations stay (same treatment as `Appointment.vetID`).
- `Volunteer.volunteerSchedule` holds structured availability compactly (`"Mon:MA;Wed:E"`); older free text is left as-is. Volunteer onboarding backfill: every non-Pending volunteer marked onboarded (`…_volunteer_onboarding_backfill`).
- Sprint 10: `Notification` (`userID` FK `ON DELETE CASCADE`, `type NotificationType`, `title VARCHAR(120)`, `body VARCHAR(300)`, `link VARCHAR(200)` null, `readAt` null = unread, `createdAt`; indexes `(userID, createdAt)` and `(userID, readAt)`). Migration `20261018120000_in_app_notifications` **replaced** the original, never-used Notification table (scheduled reminders, no FK) and dropped its three enums. Seed: rows covering every type, built with `messages.js` so they read like real ones; the adopter visit notices link to real seeded visits.
- Sprint 9: `Users.emailVerified` (backfilled `true` for existing accounts); `Closed` added to every role's account-status enum and `Declined` to Staff/Vet/Admin/Volunteer (own migration — a new enum value can't be used in the transaction that adds it); `AccountToken` (`tokenHash VARCHAR(64)` UNIQUE, `purpose` enum, `newEmail` for email changes, `expiresAt`, `usedAt`; `ON DELETE CASCADE` from Users). Admins whose own deactivation was on record were relabelled Closed; other pre-split Deactivated rows stay Deactivated (origin unknown).
- Sprint 8 AI tables, all `ON DELETE CASCADE` (disposable caches + quiz): `AdopterQuiz` (PK `adopterID`, `answers` JSON of option codes; `…_adopter_match_quiz`), `AdopterMatch` (PK `(adopterID, petID)`, `ruleScore`, `aiScore` null = rule-only, `totalScore`, `reason VARCHAR(300)`, `computedAt`; same migration; cascades from adopter and pet), `PetHealthSummary` (PK `petID`, `inputHash VARCHAR(64)`, `summary VARCHAR(1500)`, `pointsToReview` JSON, `generatedAt`; `…_pet_health_summary`). `Pet.updatedAt` (`@updatedAt`, `…_pet_updated_at`) exists for match-cache staleness.

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
| 7 | Volunteer + donor portals — volunteer onboarding before approval, tasks, events (read-only, staff assign), assisted appointments, availability; donor skippable onboarding, Stripe donations, history + stats; both profiles/close account | ✅ |
| 8 | AI compatibility matcher + health-passport summary (Groq / any OpenAI-compatible provider via `services/ai/`) — personality quiz, rule scorer + one AI call per recompute, cached matches and summaries, rule-only fallback | ✅ |
| 9 | Email & account security — Brevo HTTPS email service (console fallback), email verification + soft gate on applying/donating, forgot/reset/change password, self-service reactivation of Closed accounts, two-step email change, Closed/Declined status split, account + review notice emails | ✅ |
| 10 | In-app notifications — 28 event types across all six roles, live over Server-Sent Events (bell + dropdown, Notifications page, unread counts, token renewal on an open dashboard, chime), admin capacity alerts, staff visit cancel | ✅ |
| 11 | Testing — honest coverage + 80/70 gate, backend gaps closed (95% lines / 86% branches), crash-proof integration cleanup + leftover report, Vitest + RTL client tests, GitHub Actions CI, Cypress specs (email-verification gate, apply → Stripe hand-off + withdraw, visit confirmed → live notification) | ✅ |
| 12 | Deployment, polish, final report — $0 hosting: Vercel (client) + Render free (API, `render.yaml`) + Supabase free (Session pooler); migrations re-baselined into one; Docker fixed to run against Supabase; Vite 6 / Vitest 4, production `npm audit` clean on the server | — |

---

## Code Style

- 2-space indent · single quotes (JS) · TS throughout frontend · async/await, not `.then()` chains
- Controllers thin — business logic in services · standard response envelope on every response
- **Never expose** `userPassword`, `refreshToken`, `governmentID`, `stripeCustomerID`
- Prisma for all DB access — raw SQL only for PostGIS (`prisma.$queryRaw`)
- Tests in `server/src/tests/unit|integration/`; integration seeds via API calls, records every row with the `trackTestData()` tracker as it's created and calls `cleanUp()` in `afterAll`, runs `--runInBand` (see Testing)
- Filters: closed/fixed-value validated strictly (400 on bad input); open/DB-driven unvalidated (unmatched value → zero rows, not an error)
- React state: never mutate in place — build a new array/object every time (`.filter`/`.map`/spread); reference equality drives re-renders
- **Verify before merge — frontend and backend are asymmetric:** frontend has `npm run typecheck` (incl. the Cypress specs) + `npm run lint` + `npm test` (run from `client/`) and all must be clean. The backend has **neither** — it's plain JS (no TypeScript, so nothing for a typechecker to check) and ESLint isn't installed or configured there at all (no config file, not in `package.json`). Don't assume a backend lint/typecheck step exists. The closest backend sanity check is loading the app to catch syntax/require errors: `node -e "require('./src/app.js')"`, plus `npm run test:unit` (the coverage gate).
