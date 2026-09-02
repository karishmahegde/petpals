# PetPals — Animal Adoption Management System

## Claude Code Project Context

---

## What This Project Is

PetPals is a multi-shelter pet adoption platform built as a solo full-stack learning project. It serves as an internal operations backbone for shelter networks — going beyond existing solutions like Petfinder by supporting inter-shelter workflows, a universal animal health passport, and an AI-powered pet-adopter compatibility matcher.

**The core problem it solves:** Animal shelters operate in silos. PetPals unifies animal listings, adoption workflows, and medical records across all branches of an organisation in one platform.

---

## Three Innovative Differentiators

1. **Unified multi-shelter network** — animal search and workflows span all shelter branches
2. **Universal health passport** — medical records travel with an animal across inter-shelter transfers
3. **AI-powered compatibility matcher** — OpenAI API matches adopters to pets based on lifestyle and pet profile (Sprint 6)

---

## Six User Roles

| Role              | Description                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| **Admin**         | Organisation-wide oversight — manages shelters, assigns managers, views analytics |
| **Shelter Staff** | Day-to-day operations — manages pets, applications, volunteers, events, donations |
| **Adopter**       | Browses pets, submits applications, schedules visits, tracks application status   |
| **Veterinarian**  | Manages health appointments, vaccination records, universal health passport       |
| **Volunteer**     | Views assigned tasks, manages schedule, marks tasks complete                      |
| **Donor**         | Makes donations to specific shelter branches, views donation history              |

---

## Tech Stack

### Frontend (`client/`)

- **React 18** + **Vite** + **TypeScript**
- **Tailwind CSS** — design tokens in `tailwind.config.js` (rose, gold, teal families + neutrals; Benne display font + Montserrat body font)
- **React Router v6**
- **Zustand** — global/auth state (who is logged in, access token in memory)
- **TanStack Query** — server state, data fetching, caching, background sync
- **Axios** — configured via `client/src/logic/api/axiosInstance.ts`
- **react-icons** — Fa*, Hi*, Pi*, Tb* families in use
- **react-hot-toast** — `<Toaster />` provider mounted once near app root; styling configured there, not per-call
- **embla-carousel-react** + **embla-carousel-autoplay** — Home page carousel (autoplay) and Featured Pets slider (drag-only)

### Backend (`server/`)

- **Node.js 18 + Express**
- **Prisma ORM** — schema at `server/src/prisma/schema.prisma`
- **PostgreSQL 15 + PostGIS** — PostGIS for geolocation (`ST_MakePoint`, `ST_SetSRID`, `ST_Distance`, `ST_DWithin`)
- **Supabase** — managed Postgres + media storage; bucket is `pet-images`
- **zipcodes** (npm) — offline US zip-to-coordinates lookup, isolated behind a generic interface (see Geocoding Module)
- **JWT** — two-token stateless auth (access 15m + refresh 7d)
- **bcrypt** — password hashing (10 salt rounds)
- **cookie-parser** — httpOnly cookie parsing for refresh flow
- **node-cron** — nightly cleanup of expired TokenDenylist entries

### Infrastructure

- **Docker + Docker Compose** — local dev
- **Vercel** (frontend) / **Railway** (backend)
- **GitHub** — branch strategy: `main` → `dev` → `feature/*`

### Testing

- **Jest + Supertest** — unit + integration (target: 70% coverage)
- **Cypress** — E2E, critical adoption flows only

### AI Feature (Sprint 6)

- **OpenAI API** — pet-adopter compatibility matcher

---

## ⚠️ Permanent Known Issues / Workarounds

### PostGIS migration drift (CRITICAL)

**Never run `npx prisma migrate dev`** — it will detect drift from the manually-added `shelterLocation` geography column and ask to reset the database.

For any schema change:

1. Edit `schema.prisma`
2. Apply the SQL change directly in Supabase SQL editor
3. Run `npx prisma generate` to regenerate the client

The `shelterLocation` column must always be re-added manually after any DB reset:

```sql
ALTER TABLE "Shelter" ADD COLUMN "shelterLocation" geography(Point, 4326);
```

Seed file uses `prisma.$executeRaw` for PostGIS values — intentional.

### CHAR(n) padding risk

`CHAR(n)` right-pads shorter values with spaces, breaking strict string comparisons. Use `VARCHAR` unless the column's declared length exactly matches its content width (all `*Sex CHAR(1)` columns are safe; `petSex` was fixed from `CHAR(2)` → `CHAR(1)` in Sprint 2). Check this pattern on any new fixed-length column.

### TanStack Query — key on what queryFn actually consumes

`queryKey` must reflect everything `queryFn` depends on, not just the state that superficially looks like "the input." A computed override driven by different state than the nominal `filters` object can silently break refetching if the key doesn't include it. (Full incident: Sprint 2 pets-query bug, see past chats.)

### Age filtering — computed cutoff, not stored value

`petDOB` → `buildAgeFilter(minAge, maxAge)`: `minAge` uses direct `lte`; `maxAge` requires shifting the cutoff back one month AND using strict `gt` (not `gte`) to avoid excluding a pet exactly at the boundary. Both parts required together.

---

## Authentication System (Sprint 1 Complete)

### Two-token architecture

| Token         | Storage                   | Expiry     | Purpose                                                          |
| ------------- | ------------------------- | ---------- | ---------------------------------------------------------------- |
| Access token  | Zustand memory (frontend) | 15 minutes | Sent in Authorization header on every protected API request      |
| Refresh token | httpOnly cookie (browser) | 7 days     | Used only to issue new access tokens — never sent in API headers |

### USERS table (central auth table)

All six role-specific tables (Admin, Staff, Veterinarian, Adopter, Volunteer, Donor) share a central `USERS` table via `userID` as PK/FK. Stores `userEmail`, `userPassword` (hashed), `role`, `refreshToken` (hashed).

### Session restore on page load

`App.tsx` calls `POST /auth/refresh-token` using the httpOnly cookie on every load. Success populates Zustand (token + user info incl. name from role table). Failure → public pages, `ProtectedRoute` redirects to `/login` on protected-route access attempts.

### Auth endpoints

| Endpoint                   | Auth required    | Notes                                                                     |
| -------------------------- | ---------------- | ------------------------------------------------------------------------- |
| `POST /auth/register`      | No               | Creates USERS row + role-specific row atomically via `$transaction`       |
| `POST /auth/login`         | No               | Returns access token + sets httpOnly cookie; fetches name from role table |
| `POST /auth/logout`        | Yes (Bearer)     | Nullifies `USERS.refreshToken` + clears cookie                            |
| `POST /auth/refresh-token` | No (cookie only) | httpOnly cookie is the only auth mechanism                                |

### Frontend route guards

- `ProtectedRoute` — redirects to `/login` if no token in Zustand
- `RoleRoute` — redirects to `/forbidden` if role not permitted

### Backend RBAC middleware

- `authenticate.js` — verifies Bearer token, attaches `req.user`
- `authorizeRoles.js` — factory middleware, e.g. `authorizeRoles('Staff', 'Admin')`

### Pending (Sprint 3 dependency)

`/login` needs to read `location.state?.redirectTo` after login and navigate there (required by `PetDetailsModal`'s "Adopt" button redirect flow), falling back to default behavior if unset.

---

## Folder Structure

```
petpals/
├── client/
│   ├── src/
│   │   ├── logic/
│   │   │   ├── api/            # axiosInstance.ts, authApi.ts, petsApi.ts
│   │   │   ├── route/          # ProtectedRoute.tsx, RoleRoute.tsx
│   │   │   ├── store/          # useAuthStore.ts (Zustand: { user, token, role })
│   │   │   └── geocoding/      # (empty — geocoding is server-side only)
│   │   ├── static/
│   │   │   ├── assets/images/branding/
│   │   │   └── content/        # CMS-ready static page copy, one file/folder per page
│   │   ├── components/
│   │   │   ├── ui/             # Reusable, content-agnostic (Card, PetCatalogCard, FilterControls...)
│   │   │   └── layout/         # Navbar, Footer, PublicLayout
│   │   ├── pages/
│   │   │   ├── public/
│   │   │   │   ├── home/       # Home.tsx, Carousel.tsx, FeaturedPets.tsx, Searchbar.tsx
│   │   │   │   ├── adopt/      # PetCatalog.tsx (owns filter state), PetFilterBar.tsx, ShelterLocationFilter.tsx, PetDetailsModal.tsx
│   │   │   │   ├── auth/       # Login.tsx, Register.tsx
│   │   │   │   └── errors/     # Forbidden.tsx, NotFound.tsx
│   │   │   ├── protected/      # adopter/ staff/ vet/ volunteer/ donor/ admin/
│   │   │   ├── about/          # planned
│   │   │   └── volunteerinfo/  # planned
│   │   ├── styles/index.css
│   │   ├── main.tsx
│   │   ├── App.tsx             # Routes + session restore on mount
│   │   └── vite-env.d.ts
│   ├── index.html / vite.config.ts / tailwind.config.js / .eslintrc.cjs
│
├── server/
│   ├── src/
│   │   ├── routes/             # grouped: auth/ public/ adopter/ — one <domain>.routes.js per file
│   │   ├── controllers/        # same grouping as routes/
│   │   ├── middleware/         # authenticate.js, authorizeRoles.js, errorHandler.js, upload.js
│   │   ├── services/
│   │   │   ├── auth/ public/ adopter/
│   │   │   ├── geocoding/      # index.js is the ONLY importable file; usPostalCodeGeocoder.js is the only "US"-aware file
│   │   │   └── storage/        # index.js is the ONLY importable file (Supabase Storage)
│   │   ├── utils/               # errors.js, response.js
│   │   ├── config/prisma.js    # Singleton Prisma client, PrismaPg adapter
│   │   ├── prisma/schema.prisma / seed.js
│   │   ├── tests/unit/ integration/
│   │   ├── app.js / index.js
│   ├── .env.example / package.json
│
├── docs/                        # Numbered .docx reference files
├── docker-compose.yml / .gitignore / README.md / CLAUDE.md
```

### Component Placement Rule

Test: reusable across _different, unrelated_ pages with no fixed content of its own, or built for one page's content only?

- Generic, content-agnostic, reused → `components/ui/`
- Page-specific, even if complex → sibling of the page that owns it

### State Ownership Rule

State lives in exactly one place (the page component); everything below is a relay — displays what it's given via props, reports changes upward via callbacks, never keeps a competing local copy of the same truth.

Related: conditional rendering (`{isOpen && <X/>}`) fully unmounts/resets state; CSS-based hiding (`hidden` class) preserves it. Choose deliberately based on whether a user would expect state to persist across a collapse/expand.

---

## Database — Pet Catalog Additions (Sprint 2)

| Column         | Table | Purpose                                                                                                                    |
| -------------- | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| `petDOB`       | Pet   | Replaced `petAge` (static, went stale) — age computed live at request time                                                 |
| `featuredFlag` | Pet   | `BOOLEAN DEFAULT FALSE` — powers Home page Featured Pets (`GET /pets/featured`); set via SQL for now, staff toggle planned |

`petSex` narrowed `CHAR(2)` → `CHAR(1)` — see Known Issues.
`species` filtering on `GET /pets` migrated name-based → ID-based (`?speciesID=1`), matching `GET /breeds` convention.

---

## API Design

### Base URL

- Production: `https://petpals-api.up.railway.app/api/v1`
- Local dev: `http://localhost:5000/api/v1`

### Naming Conventions

- Plural nouns: `/pets`, `/adopters`, `/shelters`
- Kebab-case multi-word: `/adoption-applications`, `/pet-photos`
- No verbs in URLs — HTTP method conveys action
- One level of nesting only: `/pets/:id/photos`
- Query params for filtering/sorting/pagination: `/pets?species=dog&page=1&limit=20`
- `PATCH` for status updates: `/adoption-applications/:id/status`

### Standard Response Structure

**Success (single/list):**

```json
{
  "success": true,
  "message": "Pet retrieved successfully",
  "data": { "petID": 1, "petName": "Buddy" }
}
```

**Success (paginated) — adds `pagination`:**

```json
{ "success": true, "message": "Pets retrieved successfully", "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 143, "totalPages": 8 } }
```

`GET /pets/featured` returns a bare array, no pagination — small fixed result set.

**Error:**

```json
{
  "success": false,
  "message": "Pet not found",
  "error": { "code": "NOT_FOUND", "details": "No pet exists with ID 42" }
}
```

### Error Codes

| Code                    | HTTP Status | When                              |
| ----------------------- | ----------- | --------------------------------- |
| `BAD_REQUEST`           | 400         | Invalid or missing input          |
| `UNAUTHORIZED`          | 401         | No token or token invalid/expired |
| `FORBIDDEN`             | 403         | Valid token but wrong role        |
| `NOT_FOUND`             | 404         | Resource does not exist           |
| `CONFLICT`              | 409         | Duplicate record                  |
| `VALIDATION_ERROR`      | 422         | Request body failed validation    |
| `INTERNAL_SERVER_ERROR` | 500         | Unexpected server error           |

### Public Pet Catalog Endpoints (Sprint 2 — complete)

| Method | Endpoint           | Auth | Notes                                                                   |
| ------ | ------------------ | ---- | ----------------------------------------------------------------------- |
| GET    | `/pets`            | No   | Full filter set — see Filter System                                     |
| GET    | `/pets/:id`        | No   | Single pet detail                                                       |
| GET    | `/pets/featured`   | No   | `featuredFlag=true AND adoptionStatus="available"`, no pagination       |
| GET    | `/species`         | No   | Full list, alphabetical                                                 |
| GET    | `/breeds`          | No   | Cascading, filtered by repeatable `speciesID`                           |
| GET    | `/shelters`        | No   | Full open-shelter list                                                  |
| GET    | `/shelters/nearby` | No   | `lat`/`lng` OR `postalCode` (mutually exclusive), `radius` default 25km |

### Resource Domains (remaining, not yet built)

| Domain                | Base Path                        |
| --------------------- | -------------------------------- |
| Auth                  | `/auth`                          |
| Adopters              | `/adopters`                      |
| Adoption Applications | `/adoption-applications`         |
| Staff                 | `/staff`                         |
| Appointments          | `/appointments`                  |
| Vaccinations          | `/appointments/:id/vaccinations` |
| Tasks                 | `/tasks`                         |
| Events                | `/events`                        |
| Donors                | `/donors`                        |
| Donations             | `/donations`                     |
| Transfers             | `/transfers`                     |

---

## Filter System (Sprint 2 — complete)

Public pet catalog (`/adopt`), six independent filters. Full reference: `docs/09-Filter_System_Deep_Dive.docx`.

- **Live vs. staged:** species/breed/size/age refine instantly; location search requires explicit "Find Nearby Shelters" trigger (two-step network chain).
- **Shelter filtering:** `selectedShelterIDs` (manual) and `nearbyShelterIDs` (location search) tracked as separate arrays, merged via deduplicated union only when building the `/pets` request — kept separate for different lifecycles and UI distinction (gold "Nearby" badge). Zero-result location search forces `petFilters.shelterID = [-1]` (sentinel, never matches) to distinguish "searched, found nothing" from "no filter applied."
- **Geocoding module:** `GET /shelters/nearby` accepts `lat`/`lng` directly or `postalCode` (resolved server-side via `services/geocoding/`). `index.js` is the only importable file; `usPostalCodeGeocoder.js` is the only US-specific file — supporting another country means one new file + one import change.
- **PostGIS query pattern:** `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` — note lng first. `ST_Distance` measures (meters→km, 2dp); `ST_DWithin` filters (uses spatial indexes, more efficient than manual distance comparison).
- **Home page search handoff:** `Searchbar.tsx` never fetches directly — builds a `/adopt` URL and navigates; `PetCatalog.tsx` reads params once on mount and seeds its own state via the same setters used elsewhere (no parallel logic path).

---

## PetDetailsModal (in progress — Sprint 2/3 boundary)

Opens over `/adopt` via card click or deep link (`?petID=X`). `openId` state and URL-reading logic live in `PetCatalog.tsx`, not `PetCatalogCard.tsx` — the card receives `openId` + `onKnowMore(petID)` as props and never decides its own behavior (needed since the card is reused on `/adopt`, opening the modal, and on Home's Featured Pets, which navigates to `/adopt?petID=X` first).

"Adopt" button: logged in → `/adopt/apply/:petID` (placeholder route). Logged out → `/login` with `{ state: { redirectTo: '/adopt/apply/:petID' } }` (see Auth pending items).

---

## Non-Functional Requirements

| ID    | Category        | Requirement                                                    |
| ----- | --------------- | -------------------------------------------------------------- |
| NF-01 | Security        | bcrypt + two-token JWT auth (access 15m + refresh 7d httpOnly) |
| NF-02 | Security        | RBAC on all endpoints via `authorizeRoles`                     |
| NF-03 | Performance     | API response < 500ms for standard CRUD                         |
| NF-04 | Scalability     | New shelters via admin panel only — no architectural changes   |
| NF-05 | Availability    | 99.5% uptime target                                            |
| NF-06 | Data Integrity  | ACID transactions for adoption-critical data                   |
| NF-07 | Geolocation     | PostGIS for location-based search                              |
| NF-08 | Maintainability | 70% test coverage; unit + integration priority                 |
| NF-09 | Usability       | Responsive and accessible, desktop + mobile                    |
| NF-10 | Data Privacy    | Sensitive fields never exposed in API responses                |
| NF-11 | API Docs        | All endpoints documented via Swagger/OpenAPI                   |
| NF-12 | Error Handling  | Consistent structured error responses                          |

---

## Sprint Plan

| Sprint | Focus                                                                                                          | Status          |
| ------ | -------------------------------------------------------------------------------------------------------------- | --------------- |
| 1      | Auth + project setup                                                                                           | ✅ Complete     |
| 2      | Public portal — pet catalog, filter system, Home page, PetDetailsModal                                         | ✅ Complete     |
| 3      | Adopter portal — profile, application flow, status tracking, visit scheduling, favorites, /login redirect-back | 🚧 In progress  |
| 4      | Shelter staff and admin operations                                                                             | Upcoming        |
| 5      | Vet, volunteer, donor flows                                                                                    | Upcoming        |
| 6      | AI compatibility matcher (OpenAI API)                                                                          | Upcoming        |
| 7      | Testing + 70% coverage + cleanup (remove TokenDenylist, migrate to RefreshTokens table)                        | Upcoming        |
| 8      | Deployment, polish, final report                                                                               | Upcoming        |

---

## Code Style Preferences

- 2-space indentation
- Single quotes (JS); TypeScript throughout frontend
- Async/await over `.then()` chains
- Controllers thin — business logic in services
- Standard response structure on all API responses
- Never expose `userPassword`, `refreshToken`, `governmentID`, `stripeCustomerID` in API responses
- Prisma for all DB access — no raw SQL except PostGIS (`prisma.$queryRaw`)
- All routes under `/api/v1/`
- Tests: `server/src/tests/unit/` and `integration/`; integration tests seed via API calls, clean up via Prisma in `afterAll`, run with `--runInBand`
- Frontend: closed/fixed-value filters validated strictly (400 on invalid input); open/DB-driven filters unvalidated (unmatched value → zero rows, not an error)
- React state: never mutate in place — always build new array/object (`.filter()`, `.map()`, spread) — reference equality drives re-renders
