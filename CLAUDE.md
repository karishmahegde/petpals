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

| Role | Description |
|---|---|
| **Admin** | Organisation-wide oversight — manages shelters, assigns managers, views analytics |
| **Shelter Staff** | Day-to-day operations — manages pets, applications, volunteers, events, donations |
| **Adopter** | Browses pets, submits applications, schedules visits, tracks application status |
| **Veterinarian** | Manages health appointments, vaccination records, universal health passport |
| **Volunteer** | Views assigned tasks, manages schedule, marks tasks complete |
| **Donor** | Makes donations to specific shelter branches, views donation history |

---

## Tech Stack

### Frontend (`client/`)
- **React 18** + **Vite** + **TypeScript** — UI framework, build tool, and type system
- **Tailwind CSS** — utility-first styling; design tokens defined in `tailwind.config.js` (rose, gold, teal families + neutrals; Benne display font + Montserrat body font)
- **React Router v6** — client-side routing, SPA navigation
- **Zustand** — global/auth state (who is logged in, access token in memory)
- **TanStack Query** — server state, data fetching, caching, background sync. Used extensively for all public-catalog data fetching (see Filter System section below)
- **Axios** — HTTP client; configured via `client/src/logic/api/axiosInstance.ts`
- **react-icons** — icon library (Fa*, Hi*, Pi*, Tb* families in use across the codebase)
- **react-hot-toast** — toast notifications. `<Toaster />` provider mounted once near the app root; styling configured there, not per-call
- **embla-carousel-react** + **embla-carousel-autoplay** — headless carousel, used for the Home page image carousel (autoplay) and the Featured Pets slider (drag-only, no autoplay/arrows)

### Backend (`server/`)
- **Node.js 18 + Express** — REST API server
- **Prisma ORM** — database access layer; schema at `server/src/prisma/schema.prisma`
- **PostgreSQL 15 + PostGIS** — primary relational DB; PostGIS for geolocation queries (`ST_MakePoint`, `ST_SetSRID`, `ST_Distance`, `ST_DWithin` — see Geolocation section below)
- **Supabase** — managed Postgres hosting + media storage for pet photos (bucket is `pet-images`, not `pet-photos` — corrected during Sprint 2 seed data work)
- **zipcodes** (npm) — offline US zip-to-coordinates lookup, isolated behind a generic interface (see Geocoding Module section below)
- **JWT** — two-token stateless auth (access token 15m + refresh token 7d)
- **bcrypt** — password hashing (10 salt rounds)
- **cookie-parser** — parses httpOnly cookies for refresh token flow
- **node-cron** — nightly cleanup of expired TokenDenylist entries

### Infrastructure
- **Docker + Docker Compose** — local development environment
- **Vercel** — frontend deployment
- **Railway** — backend deployment
- **GitHub** — source control; branch strategy: `main` → `dev` → `feature/*`

### Testing
- **Jest + Supertest** — unit and integration tests (target: 70% coverage)
- **Cypress** — E2E tests scoped to critical adoption flows only

### AI Feature (Sprint 6)
- **OpenAI API** — pet-adopter compatibility matcher

---

## ⚠️ Permanent Known Issues / Workarounds

### PostGIS migration drift (CRITICAL)
**Never run `npx prisma migrate dev`** — it will detect drift from the manually-added `shelterLocation` geography column and ask to reset the database.

Instead, for any schema change:
1. Edit `schema.prisma`
2. Apply the SQL change directly in Supabase SQL editor
3. Run `npx prisma generate` to regenerate the client

The `shelterLocation` column on the `Shelter` table must always be added manually after any DB reset:
```sql
ALTER TABLE "Shelter" ADD COLUMN "shelterLocation" geography(Point, 4326);
```

The seed file uses `prisma.$executeRaw` for PostGIS values — this is intentional.

### petSex CHAR padding (fixed in Sprint 2)
`petSex` was originally `CHAR(2)` — a fixed-length type that silently right-pads shorter values with spaces (`"M"` becomes `"M "`), breaking strict string comparisons (`=== "M"`) downstream. Fixed by trimming existing data and narrowing the column to `CHAR(1)`, which cannot pad since the declared length exactly matches the content length. Worth checking any other `CHAR(n)` column where `n` is larger than the actual content width for the same latent bug — every other `*Sex CHAR(1)` column (staff, vet, volunteer, donor) was already correctly sized and unaffected.

### TanStack Query — key on what queryFn actually consumes
A real bug from Sprint 2's filter system: the pets query was keyed on `filters` (raw component state), but the actual request object (`petFilters`) included a computed override (`shelterID: [-1]`) driven by a *different* piece of state (`nearbySearchEmpty`) that wasn't part of `filters` at all. TanStack Query's `queryKey` comparison is structural — since `filters` itself wasn't changing, the query silently failed to refetch even though the real request had changed. **Fixed by keying on `petFilters` (the object passed to `queryFn`) instead of `filters`.** General rule: `queryKey` must reflect everything `queryFn` actually depends on, not just the state that superficially looks like "the input."

---

## Authentication System (Sprint 1 Complete)

### Two-token architecture
| Token | Storage | Expiry | Purpose |
|---|---|---|---|
| Access token | Zustand memory (frontend) | 15 minutes | Sent in Authorization header on every protected API request |
| Refresh token | httpOnly cookie (browser) | 7 days | Used only to issue new access tokens — never sent in API headers |

### USERS table (central auth table)
All six role-specific tables (Admin, Staff, Veterinarian, Adopter, Volunteer, Donor) share a central `USERS` table via `userID` as their primary key and foreign key. The `USERS` table stores `userEmail`, `userPassword` (hashed), `role`, and `refreshToken` (hashed).

### Session restore on page load
On every app load, `App.tsx` calls `POST /auth/refresh-token` using the httpOnly cookie. On success, the returned access token and user info (including name fetched from role table) populate Zustand. On failure, the user sees public pages and gets redirected to `/login` by `ProtectedRoute` if they try to access a dashboard.

### Auth endpoints
| Endpoint | Auth required | Notes |
|---|---|---|
| `POST /auth/register` | No | Creates USERS row + role-specific row atomically via $transaction |
| `POST /auth/login` | No | Returns access token + sets httpOnly cookie; also fetches name from role table |
| `POST /auth/logout` | Yes (Bearer) | Nullifies USERS.refreshToken + clears cookie; access token expires naturally |
| `POST /auth/refresh-token` | No (cookie only) | No Bearer token required — httpOnly cookie is the only auth mechanism |

### Frontend route guards
- `ProtectedRoute` — wraps all dashboard routes; redirects to `/login` if no token in Zustand
- `RoleRoute` — wraps role-specific routes; redirects to `/forbidden` if role not permitted

### Backend RBAC middleware
- `authenticate.js` — verifies Bearer token, attaches `req.user` to request
- `authorizeRoles.js` — factory middleware; `authorizeRoles('Staff', 'Admin')` checks `req.user.role`

### Pending (Sprint 3 dependency)
- `/login` needs to read `location.state?.redirectTo` after a successful login and navigate there instead of its normal default — this is a real dependency introduced by `PetDetailsModal`'s "Adopt" button (logged-out users are sent to `/login` with the intended destination attached), falling back to existing behavior if not set.

---

## Folder Structure

```
petpals/
├── client/
│   ├── src/
│   │   ├── logic/
│   │   │   ├── api/
│   │   │   │   ├── axiosInstance.ts   # Pre-configured axios: baseURL, withCredentials, request/response interceptors (isAuthCall guard prevents infinite redirect loops on 401)
│   │   │   │   ├── authApi.ts         # Auth API functions: register, login, logout, refreshToken
│   │   │   │   └── petsApi.ts         # Public catalog API functions + types: getSpecies, getBreeds, getShelters, getNearbyShelters, getPets, getFeaturedPets, getPetById
│   │   │   ├── route/
│   │   │   │   ├── ProtectedRoute.tsx
│   │   │   │   └── RoleRoute.tsx
│   │   │   ├── store/
│   │   │   │   └── useAuthStore.ts    # Zustand: { user, token, role } + login/logout actions
│   │   │   └── geocoding/             # (frontend has no geocoding logic — this lives server-side only)
│   │   ├── static/
│   │   │   ├── assets/
│   │   │   │   └── images/branding/   # logoNav.png, logoFooter.png, background.png
│   │   │   └── content/               # CMS-ready static page copy, one file/folder per page — e.g. content/adopt.ts, content/home/carousel.ts
│   │   ├── components/
│   │   │   ├── ui/                    # Reusable, content-agnostic primitives — Card.tsx, PetCatalogCard.tsx, SectionContainer.tsx, SectionHeading.tsx, FilterControls.tsx (CheckboxDropdown, Dropdown, Pill)
│   │   │   └── layout/                # Navbar.tsx, Footer.tsx, PublicLayout.tsx
│   │   ├── pages/
│   │   │   ├── public/
│   │   │   │   ├── home/              # Home.tsx, Carousel.tsx, FeaturedPets.tsx, Searchbar.tsx — all page-local, not in components/ui, since each is specific to Home's content (see Component Placement Rule below)
│   │   │   │   ├── adopt/             # PetCatalog.tsx (owns all filter state), PetFilterBar.tsx, ShelterLocationFilter.tsx, PetDetailsModal.tsx
│   │   │   │   ├── auth/              # Login.tsx, Register.tsx
│   │   │   │   └── errors/            # Forbidden.tsx, NotFound.tsx
│   │   │   ├── protected/
│   │   │   │   ├── adopter/ staff/ vet/ volunteer/ donor/ admin/
│   │   │   ├── about/                 # planned — not yet built
│   │   │   └── volunteerinfo/         # planned — not yet built
│   │   ├── styles/
│   │   │   └── index.css              # Tailwind directives
│   │   ├── main.tsx
│   │   ├── App.tsx                    # Root component: routes + session restore on mount
│   │   └── vite-env.d.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── .eslintrc.cjs
│
├── server/
│   ├── src/
│   │   ├── routes/                    # auth.routes.js, pets.routes.js, shelters.routes.js
│   │   ├── controllers/               # auth.controller.js, pets.controller.js, shelters.controller.js
│   │   ├── middleware/                # authenticate.js, authorizeRoles.js, errorHandler.js
│   │   ├── services/
│   │   │   ├── auth.service.js
│   │   │   ├── pets.service.js
│   │   │   ├── shelters.service.js
│   │   │   └── geocoding/             # Isolated geocoding module (see below)
│   │   │       ├── index.js           # The ONLY file anything else should import from
│   │   │       └── usPostalCodeGeocoder.js  # The ONLY file allowed to mention "zipcodes" or "US"
│   │   ├── utils/                     # errors.js (ERROR_CODES map), response.js (successResponse/errorResponse)
│   │   ├── config/
│   │   │   └── prisma.js              # Singleton Prisma client with PrismaPg adapter
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.js                # Seeds all 6 roles + shelters + 17 pets
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   ├── app.js
│   │   └── index.js
│   ├── .env.example
│   └── package.json
│
├── docs/                              # Numbered .docx reference files — 08-Public_API_Reference.docx, 09-Filter_System_Deep_Dive.docx
├── docker-compose.yml
├── .gitignore
├── README.md
└── CLAUDE.md
```

### Component Placement Rule (established in Sprint 2)
Test: is this component genuinely reusable across *different, unrelated* pages with no fixed content of its own, or is it built for one page's content and will only ever be used there?
- **Generic, content-agnostic, reused across pages** → `components/ui/` (e.g. `Card`, `CheckboxDropdown`)
- **Page-specific, even if visually complex** → lives as a sibling of the page that owns it (e.g. `PetFilterBar.tsx`/`ShelterLocationFilter.tsx` next to `PetCatalog.tsx`; `Carousel.tsx`/`FeaturedPets.tsx`/`Searchbar.tsx` next to `Home.tsx`)

### State Ownership Rule (established in Sprint 2)
State lives in exactly one place — the page component (e.g. `PetCatalog.tsx`) — and every component below it is a relay: it displays what it's given via props and reports changes upward via callback props, never maintaining its own competing copy of the same truth. This was the root cause of two real Sprint 2 bugs (Distance pill showing "null" after either a URL-seeded search or a filter-panel collapse/remount) — both fixed by deriving display values from the single owned source (`nearbySearch`, passed down as a prop) rather than duplicating that data as separate local state in a child component.

Related: `{isOpen && <Component />}` (conditional rendering) fully unmounts and remounts a component, resetting all of its local state — it is not equivalent to CSS-based hiding (`className={isOpen ? "" : "hidden"}`), which keeps the component alive and its state intact. Use conditional rendering when hidden content is genuinely disposable; use CSS hiding when a user would reasonably expect state to persist across a collapse/expand (this was the fix for the filter-panel-collapse bug above).

---

## Database — Pet Catalog Additions (Sprint 2)

Beyond the original 27-table schema, Sprint 2 added:

| Column | Table | Purpose |
|---|---|---|
| `petDOB` | Pet | Replaced `petAge` (a static integer that went stale). Age is now always computed live from `petDOB` at request time. |
| `featuredFlag` | Pet | `BOOLEAN DEFAULT FALSE` — powers the Home page's Featured Pets section (`GET /pets/featured`). Set manually via SQL for now; a staff-facing toggle is planned for a later sprint. |

`petSex` was narrowed from `CHAR(2)` to `CHAR(1)` — see Known Issues above.

`species` filtering on `GET /pets` migrated from name-based (`?species=Dog`) to ID-based (`?speciesID=1`), matching `GET /breeds`' existing convention — see API Design section below.

---

## API Design

### Base URL
- Production: `https://petpals-api.up.railway.app/api/v1`
- Local dev: `http://localhost:5000/api/v1`

### Naming Conventions
- Plural nouns for all resources: `/pets`, `/adopters`, `/shelters`
- Kebab-case for multi-word resources: `/adoption-applications`, `/pet-photos`
- No verbs in URLs — HTTP method conveys the action: `GET /pets` not `/getPets`
- One level of nesting only: `/pets/:id/photos`, `/shelters/:id/staff`
- Query params for filtering, sorting, pagination: `/pets?species=dog&page=1&limit=20`
- `PATCH` for status updates (partial update): `/adoption-applications/:id/status`

### Standard Response Structure

**Success (single/list):**
```json
{
  "success": true,
  "message": "Pet retrieved successfully",
  "data": { "petID": 1, "petName": "Buddy" }
}
```

**Success (paginated list) — adds a `pagination` object:**
```json
{
  "success": true,
  "message": "Pets retrieved successfully",
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 143, "totalPages": 8 }
}
```
Note: `GET /pets/featured` returns a bare array with no `pagination` object — it's a small, fixed result set, not paginated.

**Error:**
```json
{
  "success": false,
  "message": "Pet not found",
  "error": { "code": "NOT_FOUND", "details": "No pet exists with ID 42" }
}
```

### Error Codes
| Code | HTTP Status | When |
|---|---|---|
| `BAD_REQUEST` | 400 | Invalid or missing input |
| `UNAUTHORIZED` | 401 | No token or token invalid/expired |
| `FORBIDDEN` | 403 | Valid token but wrong role |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Duplicate record (e.g. email already registered) |
| `VALIDATION_ERROR` | 422 | Request body failed validation |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

### Public Pet Catalog Endpoints (Sprint 2 — complete)
| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/pets` | No | Full filter set — see Filter System below |
| GET | `/pets/:id` | No | Single pet detail |
| GET | `/pets/featured` | No | `featuredFlag=true AND adoptionStatus="available"`, no pagination |
| GET | `/species` | No | Full list, alphabetical |
| GET | `/breeds` | No | Cascading, filtered by repeatable `speciesID` |
| GET | `/shelters` | No | Full open-shelter list |
| GET | `/shelters/nearby` | No | `lat`/`lng` OR `postalCode` (mutually exclusive), `radius` (default 25km) |

### Resource Domains (remaining, not yet built)
| Domain | Base Path |
|---|---|
| Auth | `/auth` |
| Adopters | `/adopters` |
| Adoption Applications | `/adoption-applications` |
| Staff | `/staff` |
| Appointments | `/appointments` |
| Vaccinations | `/appointments/:id/vaccinations` |
| Tasks | `/tasks` |
| Events | `/events` |
| Donors | `/donors` |
| Donations | `/donations` |
| Transfers | `/transfers` |

---

## Filter System (Sprint 2 — complete)

The public pet catalog (`/adopt`) supports six independent filters. Full reference: `docs/09-Filter_System_Deep_Dive.docx`.

### Live vs. staged filtering
Species, breed, size, and age refine results **instantly** on every change. Shelter location search requires an **explicit trigger** ("Find Nearby Shelters" button) since it involves a two-step network chain (resolve location → query shelters within range). This hybrid matches real-world location-search UIs (Airbnb, Zillow).

### Age filtering — computed, not stored
`petDOB` → `buildAgeFilter(minAge, maxAge)` converts a months-based range into a `petDOB` date-boundary comparison. `minAge` uses a direct `lte` comparison; `maxAge` requires shifting the cutoff back one additional month AND using a strict `gt` (not `gte`) — otherwise a pet exactly at the boundary is wrongly excluded, due to how the age-display calculation itself rounds down when today's day-of-month hasn't reached the DOB's day-of-month yet. Both parts of the fix are required together.

### Shelter filtering — two independent sources, merged
`selectedShelterIDs` (manual multi-select, instant) and `nearbyShelterIDs` (from a location search, async) are tracked as **separate arrays** and only combined via a deduplicated union (`mergedShelterIDs`) when building the actual `/pets` request. Kept separate because they have different lifecycles and so the UI can visually distinguish manually-picked shelters from nearby-found ones (gold accent + "Nearby" badge in the Shelter dropdown).

**Zero-result location search:** a completed search that finds no shelters is distinct from "no location filter applied at all." If `nearbySearchEmpty` is true and no shelter is separately, manually selected, `petFilters.shelterID` is forced to `[-1]` (a sentinel ID that can never match a real shelter, same pattern used for malformed `shelterID` values in the controller) — this correctly shows zero pets, rather than silently falling back to an unfiltered catalog.

### Geolocation — isolated geocoding module
`GET /shelters/nearby` accepts `lat`/`lng` directly (from the browser's `navigator.geolocation` API) OR a `postalCode`, resolved server-side to `lat`/`lng` via `server/src/services/geocoding/`. This module is deliberately isolated: `index.js` exports one function, `resolveCoordsFromPostalCode(postalCode) => {lat, lng} | null`, and is the only thing any other file should import. `usPostalCodeGeocoder.js` is the only file allowed to reference the `zipcodes` package or "US" logic — supporting a different country later means writing one new implementation file and changing one import, nothing else in the codebase changes. Both input paths converge on the same `lat`/`lng` currency before the PostGIS query runs.

### PostGIS query pattern
```sql
ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)  -- note: lng first, then lat
```
`ST_Distance(...)` measures (returns a number, meters → divided by 1000 for km, rounded to 2dp). `ST_DWithin(...)` filters (boolean WHERE condition, more efficient than a manual `ST_Distance <= radius` comparison since it can use spatial indexes).

### Home page search bar handoff
`Searchbar.tsx` (Home page) never fetches pets directly — it builds a `/adopt` URL with `?speciesID=` or `?lat=&lng=`/`?postalCode=` and navigates. `PetCatalog.tsx` reads these once on mount (`useEffect` with an empty dependency array) and seeds its own `filters`/`nearbySearch` state via the same setters used everywhere else on the page — no parallel logic path. Location search auto-triggers "Find Nearby Shelters" on arrival (does not wait for a second click); species search seeds `filters.speciesIDs` directly.

---

## PetDetailsModal (in progress — Sprint 2/3 boundary)

Opens over `/adopt` when a pet card's "Know More" is clicked, or via deep link (`?petID=X`). `openId` state and the `?petID=` reading logic live in `PetCatalog.tsx` (not inside `PetCatalogCard.tsx`) — `PetCatalogCard` receives `openId` and an `onKnowMore(petID)` callback as props, and never decides navigation/modal-opening behavior itself. This is required because `PetCatalogCard` is reused on both `/adopt` (opens the modal in place) and Home's Featured Pets (navigates to `/adopt?petID=X` first) — two different behaviors for the same click, resolved via a callback prop rather than the component knowing which page it's on.

"Adopt" button inside the modal: logged in → navigate to `/adopt/apply/:petID` (placeholder route, application form not built until the Adopter sprint). Logged out → navigate to `/login` with `{ state: { redirectTo: '/adopt/apply/:petID' } }`, so `/login` can return the user to their intended destination after a successful login (see Auth pending items above).

---

## Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NF-01 | Security | Passwords hashed with bcrypt; two-token JWT auth (access 15m + refresh 7d httpOnly cookie) |
| NF-02 | Security | RBAC on all API endpoints via authorizeRoles middleware |
| NF-03 | Performance | API response < 500ms for standard CRUD |
| NF-04 | Scalability | New shelter branches added via admin panel only — no architectural changes |
| NF-05 | Availability | 99.5% uptime target |
| NF-06 | Data Integrity | ACID transactions for adoption-critical data |
| NF-07 | Geolocation | PostGIS for location-based shelter/animal search |
| NF-08 | Maintainability | 70% test coverage; unit + integration priority |
| NF-09 | Usability | Responsive and accessible on desktop and mobile |
| NF-10 | Data Privacy | Sensitive fields (password, refreshToken, stripeCustomerID) never exposed in API responses |
| NF-11 | API Docs | All endpoints documented via Swagger/OpenAPI |
| NF-12 | Error Handling | Consistent structured error responses (see above) |

---

## Sprint Plan

| Sprint | Focus | Status |
|---|---|---|
| 1 | Auth + project setup | ✅ Complete |
| 2 | Public portal — pet catalog, full filter system, Home page, PetDetailsModal (fetch step done, UI in progress) | Nearly complete |
| 3 | Adopter portal — profile, application flow (incl. the /adopt/apply/:petID placeholder), status tracking, visit scheduling, favorites (deferred from Sprint 2), adopted-pet vaccination view, /login redirect-back | Upcoming |
| 4 | Shelter staff and admin operations | Upcoming |
| 5 | Vet, volunteer, donor flows | Upcoming |
| 6 | AI compatibility matcher (OpenAI API) | Upcoming |
| 7 | Testing + 70% coverage + Sprint 7 cleanup (remove TokenDenylist, migrate to separate RefreshTokens table) | Upcoming |
| 8 | Deployment, polish, final report | Upcoming |

---

## Code Style Preferences
- 2-space indentation
- Single quotes for strings in JavaScript; TypeScript used throughout the frontend
- Async/await over `.then()` chains
- Controllers stay thin — business logic lives in services
- All API responses use the standard structure defined above
- Never expose `userPassword`, `refreshToken`, `governmentID`, or `stripeCustomerID` fields in API responses
- Prisma for all database access — no raw SQL except for PostGIS operations which use `prisma.$queryRaw`
- All routes mounted under `/api/v1/`
- Test files live at `server/src/tests/unit/` and `server/src/tests/integration/`
- Integration tests seed via API calls and clean up via Prisma in `afterAll`; run with `--runInBand` to avoid FK conflicts
- Frontend: closed/fixed-value filters (e.g. `size` enum) are validated strictly in the controller with a 400 on invalid input; open, database-driven filters (e.g. `breed`) are left unvalidated — an unmatched value simply returns zero rows rather than erroring, since there's no fixed list to check against
- React state: never mutate arrays/objects in place — always build a new array/object (`.filter()`, `.map()`, spread) — React's re-render decision is based on reference equality, and an in-place mutation leaves the same reference, silently skipping the re-render
