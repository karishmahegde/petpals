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
- **React 18** + **Vite** — UI framework and build tool
- **Tailwind CSS** — utility-first styling; design tokens defined in `tailwind.config.js` (rose, gold, teal families + neutrals; Benne display font + Montserrat body font)
- **React Router v6** — client-side routing, SPA navigation
- **Zustand** — global/auth state (who is logged in, access token in memory)
- **TanStack Query** — server state, data fetching, caching, background sync
- **Axios** — HTTP client; configured via `client/src/api/axiosInstance.ts`
- **react-icons** — icon library including pet-related icons (FaPaw, FaDog etc.)
- **react-hot-toast** — toast notifications

### Backend (`server/`)
- **Node.js 18 + Express** — REST API server
- **Prisma ORM** — database access layer; schema at `server/src/prisma/schema.prisma`
- **PostgreSQL 15 + PostGIS** — primary relational DB; PostGIS for geolocation queries
- **Supabase** — managed Postgres hosting + media storage for pet photos (`pet-photos` bucket)
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

---

## Folder Structure

```
petpals/
├── client/
│   ├── src/
│   │   ├── api/
│   │   │   ├── axiosInstance.ts   # Pre-configured axios: baseURL, withCredentials, request/response interceptors
│   │   │   └── authApi.ts         # Auth API functions: register, login, logout, refreshToken
│   │   ├── assets/
│   │   │   └── images/            # Background images, branding (logoNav.png etc.)
│   │   ├── components/
│   │   │   ├── ui/                # Reusable primitives — Card.tsx
│   │   │   ├── layout/            # Navbar.tsx
│   │   │   ├── forms/             # Form components
│   │   │   ├── ProtectedRoute.tsx # Redirects to /login if not authenticated
│   │   │   └── RoleRoute.tsx      # Redirects to /forbidden if role not permitted
│   │   ├── layouts/
│   │   │   └── PublicLayout.tsx   # Navbar + Outlet wrapper for public routes
│   │   ├── pages/
│   │   │   ├── adopter/
│   │   │   ├── staff/
│   │   │   ├── vet/
│   │   │   ├── volunteer/
│   │   │   ├── donor/
│   │   │   ├── admin/
│   │   │   ├── auth/              # Login.tsx, Register.tsx
│   │   │   └── errors/            # Forbidden.tsx, NotFound.tsx
│   │   ├── store/
│   │   │   └── useAuthStore.ts    # Zustand: { user, token, role } + login/logout actions
│   │   ├── styles/
│   │   │   └── index.css          # Tailwind directives
│   │   ├── main.tsx               # React entry point
│   │   ├── App.tsx                # Root component: routes + session restore on mount
│   │   └── vite-env.d.ts          # Vite env variable type declarations
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js         # Design tokens: rose/gold/teal + neutrals + font families
│   └── .eslintrc.cjs              # ESLint config (ESLint 8 + TypeScript plugin)
│
├── server/
│   ├── src/
│   │   ├── routes/                # Express routers — auth.routes.js
│   │   ├── controllers/           # Route handlers — auth.controller.js
│   │   ├── middleware/            # authenticate.js, authorizeRoles.js, errorHandler.js
│   │   ├── services/              # Business logic — auth.service.js
│   │   ├── utils/                 # errors.js (ERROR_CODES map), response.js (successResponse/errorResponse)
│   │   ├── config/
│   │   │   └── prisma.js          # Singleton Prisma client with PrismaPg adapter
│   │   ├── prisma/
│   │   │   ├── migrations/        # Migration history (do not run migrate dev — see workarounds)
│   │   │   ├── schema.prisma      # 27-table schema (includes USERS + TokenDenylist)
│   │   │   └── seed.js            # Seeds all 6 roles + 2 shelters + pets
│   │   ├── tests/
│   │   │   ├── unit/              # authenticate.test.js, authorizeRoles.test.js
│   │   │   └── integration/       # auth.register.test.js, auth.login.test.js, auth.logout.test.js
│   │   ├── app.js                 # Express app setup (no listen) — imported by tests via Supertest
│   │   └── index.js               # Entry point — imports app.js, calls app.listen()
│   ├── .env.example
│   └── package.json
│
├── docs/                          # Project documentation PDFs
├── docker-compose.yml
├── .gitignore
├── README.md
└── CLAUDE.md
```

---

## Database — 27 Tables

The full Prisma schema is at `server/src/prisma/schema.prisma`. Key tables:

| Table | Purpose |
|---|---|
| `Users` | Central auth table — userEmail, userPassword (hashed), role, refreshToken (hashed). All 6 role tables reference this via userID |
| `Admin` | Admin profile — userID (PK + FK → Users) + adminName |
| `Shelter` | Shelter branch records with PostGIS location (shelterLocation added manually — see workarounds) |
| `Staff` | Staff profile — userID (PK + FK → Users); shelterID scopes access to branch |
| `Veterinarian` | Vet profile — userID (PK + FK → Users) |
| `Species` / `Breed` | Animal taxonomy (Breed → Species) |
| `Pet` | Animal profiles with intake, status, and compatibility fields |
| `Adopter` | Adopter profile — userID (PK + FK → Users); full household/lifestyle fields |
| `Favorite` | Junction: Adopter ↔ Pet (M:M) |
| `AdoptionApplication` | Applications submitted by adopters for specific pets |
| `Visit` | Shelter visits and virtual meet-and-greets |
| `Notification` | Polymorphic — shared across all user types |
| `HealthRecord` | Medical history entries per pet (universal health passport) |
| `Vaccine` | Vaccine reference data |
| `VaccinationRecord` | Vaccination history per pet |
| `TransferHistory` | Inter-shelter transfer log |
| `Appointment` | Vet health appointments |
| `VolunteerApplication` | Pre-approval volunteer applications |
| `Volunteer` | Volunteer profile — userID (PK + FK → Users) |
| `GovernmentID` | Polymorphic identity verification across all user types |
| `Task` | Volunteer tasks created by staff |
| `VolunteerTask` | Junction: Volunteer ↔ Task (M:M) |
| `Event` | Adoption events, fundraisers, community programs |
| `VolunteerEvent` | Junction: Volunteer ↔ Event (M:M) |
| `Donor` | Donor profile — userID (PK + FK → Users) |
| `Donation` | Individual donation transactions (Stripe) |
| `TokenDenylist` | Legacy table — stores invalidated JWT tokens with expiry. Cleaned nightly by cron job. To be removed in Sprint 7 when fully replaced by refresh token nullification. |

### Key Schema Decisions
- **Central USERS table** — all 6 role tables use `userID` as both PK and FK to USERS. Registration writes to USERS first, then the role table, atomically via Prisma `$transaction`
- `GOVERNMENT_ID` and `NOTIFICATIONS` use a **polymorphic pattern** — `userID` + `userType`
- `Adopter.shelterID` is **nullable** — adopters are not permanently tied to a branch
- `Staff.staffDesignation` ENUM `('Manager', 'Senior', 'Associate')` — managers are designated per branch via `Shelter.managerStaffID`
- **Registration fields only** — name, email, password, role collected at registration; all other profile fields are nullable and collected during onboarding
- `volunteerSchedule` is a `VARCHAR(100)` free-text field — not JSON

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

**Success:**
```json
{
  "success": true,
  "message": "Pet retrieved successfully",
  "data": { "petID": 1, "petName": "Buddy" }
}
```

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

### Resource Domains
| Domain | Base Path |
|---|---|
| Auth | `/auth` |
| Pets | `/pets` |
| Adopters | `/adopters` |
| Adoption Applications | `/adoption-applications` |
| Shelters | `/shelters` |
| Staff | `/staff` |
| Appointments | `/appointments` |
| Vaccinations | `/appointments/:id/vaccinations` |
| Tasks | `/tasks` |
| Events | `/events` |
| Donors | `/donors` |
| Donations | `/donations` |
| Transfers | `/transfers` |

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
| 2 | Pet management (CRUD, photos, search) | Upcoming |
| 3 | Adoption flow (applications, visits, notifications) | Upcoming |
| 4 | Shelter staff and admin operations | Upcoming |
| 5 | Vet, volunteer, donor flows | Upcoming |
| 6 | AI compatibility matcher (OpenAI API) | Upcoming |
| 7 | Testing + 70% coverage + Sprint 7 cleanup (remove TokenDenylist, migrate to separate RefreshTokens table) | Upcoming |
| 8 | Deployment, polish, final report | Upcoming |

---

## Code Style Preferences
- 2-space indentation
- Single quotes for strings in JavaScript
- Async/await over `.then()` chains
- Controllers stay thin — business logic lives in services
- All API responses use the standard structure defined above
- Never expose `userPassword`, `refreshToken`, `governmentID`, or `stripeCustomerID` fields in API responses
- Prisma for all database access — no raw SQL except for PostGIS operations which use `prisma.$executeRaw`
- All routes mounted under `/api/v1/`
- Test files live at `server/src/tests/unit/` and `server/src/tests/integration/`
- Integration tests seed via API calls and clean up via Prisma in `afterAll`; run with `--runInBand` to avoid FK conflicts
