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
- **Tailwind CSS** — utility-first styling; design tokens defined in `tailwind.config.js`
- **React Router v6** — client-side routing, SPA navigation
- **Zustand** — global/auth state (who is logged in, client-side UI state)
- **TanStack Query** — server state, data fetching, caching, background sync
- **Axios** — HTTP client for API calls (in `client/src/services/`)

### Backend (`server/`)
- **Node.js 18 + Express** — REST API server
- **Prisma ORM** — database access layer; schema at `server/src/prisma/schema.prisma`
- **PostgreSQL 15 + PostGIS** — primary relational DB; PostGIS for geolocation queries
- **Supabase** — managed Postgres hosting + media storage for pet photos
- **JWT** — stateless authentication; token contains userID and role
- **bcrypt** — password hashing

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

## Folder Structure

```
petpals/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/          # Reusable primitives: buttons, inputs, cards
│   │   │   ├── layout/      # Navbar, sidebar, page shells
│   │   │   └── forms/       # Form components
│   │   ├── pages/
│   │   │   ├── adopter/     # Adopter-specific pages
│   │   │   ├── staff/       # Shelter staff pages
│   │   │   ├── vet/         # Veterinarian pages
│   │   │   ├── volunteer/   # Volunteer pages
│   │   │   ├── donor/       # Donor pages
│   │   │   ├── admin/       # Admin pages
│   │   │   └── auth/        # Login, register, onboarding
│   │   ├── hooks/           # Custom React hooks
│   │   ├── store/           # Zustand stores
│   │   ├── services/        # Axios API call functions (one file per resource)
│   │   ├── utils/           # Helpers and constants
│   │   └── styles/          # Global CSS (Tailwind directives)
│   ├── index.html
│   ├── vite.config.js       # Proxies /api to localhost:5000 in dev
│   └── tailwind.config.js   # Design tokens: pink, yellow, teal families
│
├── server/
│   ├── src/
│   │   ├── routes/          # Express routers — one file per resource domain
│   │   ├── controllers/     # Route handler functions — thin, delegate to services
│   │   ├── middleware/       # Auth (JWT verify), RBAC, error handling
│   │   ├── services/        # Business logic layer — called by controllers
│   │   ├── utils/           # Shared helpers
│   │   ├── config/          # DB connection, env config
│   │   ├── prisma/
│   │   │   └── schema.prisma  # 26-table schema — source of truth for DB
│   │   └── index.js         # Express entry point
│   └── tests/
│       ├── unit/
│       └── integration/
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Database — 26 Tables

The full Prisma schema is at `server/src/prisma/schema.prisma`. Key tables:

| Table | Purpose |
|---|---|
| `Admin` | System administrator accounts |
| `Shelter` | Shelter branch records with PostGIS location |
| `Staff` | Shelter staff accounts; scoped to a shelter branch |
| `Veterinarian` | Vet accounts affiliated with a shelter |
| `Species` / `Breed` | Animal taxonomy (Breed → Species) |
| `Pet` | Animal profiles with intake, status, and compatibility fields |
| `PetPhoto` | Multiple photos per pet (separate from Pet table) |
| `Adopter` | Adopter accounts with full household and lifestyle profile |
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
| `Volunteer` | Approved volunteer accounts |
| `GovernmentID` | Polymorphic identity verification across all user types |
| `Task` | Volunteer tasks created by staff |
| `VolunteerTask` | Junction: Volunteer ↔ Task (M:M) |
| `Event` | Adoption events, fundraisers, community programs |
| `VolunteerEvent` | Junction: Volunteer ↔ Event (M:M) |
| `Donor` | Donor accounts |
| `Donation` | Individual donation transactions (Stripe) |

### Key Schema Decisions
- `GOVERNMENT_ID` and `NOTIFICATIONS` use a **polymorphic pattern** — `userID` + `userType` rather than per-role tables
- `Adopter.shelterID` is **nullable** — adopters are not permanently tied to a branch
- `Staff.staffDesignation` ENUM `('Manager', 'Senior', 'Associate')` — managers are designated per branch via `Shelter.managerStaffID`
- `Staff` access is **branch-scoped** — all staff actions default to their assigned `shelterID`; cross-branch visibility is read-only
- `volunteerSchedule` is a `VARCHAR(100)` free-text field — not JSON
- `PetPhoto` is a **separate table** from `Pet`

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

**Success (single record):**
```json
{
  "success": true,
  "message": "Pet retrieved successfully",
  "data": { "petID": 1, "petName": "Buddy" }
}
```

**Success (list):**
```json
{
  "success": true,
  "message": "Pets retrieved successfully",
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 143, "totalPages": 8 }
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

### Authentication Flow
1. `POST /api/v1/auth/login` with email + password
2. Server verifies bcrypt hash
3. Returns signed JWT containing `userID` and `role`
4. Client attaches to all subsequent requests: `Authorization: Bearer <token>`
5. Express middleware validates token on all protected routes

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
| NF-01 | Security | Passwords hashed with bcrypt; auth via JWT |
| NF-02 | Security | RBAC on all API endpoints |
| NF-03 | Performance | API response < 500ms for standard CRUD |
| NF-04 | Scalability | New shelter branches added via admin panel only — no architectural changes |
| NF-05 | Availability | 99.5% uptime target |
| NF-06 | Data Integrity | ACID transactions for adoption-critical data |
| NF-07 | Geolocation | PostGIS for location-based shelter/animal search |
| NF-08 | Maintainability | 70% test coverage; unit + integration priority |
| NF-09 | Usability | Responsive and accessible on desktop and mobile |
| NF-10 | Data Privacy | Sensitive fields never exposed beyond authorised role |
| NF-11 | API Docs | All endpoints documented via Swagger/OpenAPI |
| NF-12 | Error Handling | Consistent structured error responses (see above) |

---

## Sprint Plan

| Sprint | Focus |
|---|---|
| 1 | Auth + project setup |
| 2 | Pet management (CRUD, photos, search) |
| 3 | Adoption flow (applications, visits, notifications) |
| 4 | Shelter staff and admin operations |
| 5 | Vet, volunteer, donor flows |
| 6 | AI compatibility matcher (OpenAI API) |
| 7 | Testing + 70% coverage |
| 8 | Deployment, polish, final report |

---

## Code Style Preferences
- 2-space indentation
- Single quotes for strings in JavaScript
- Async/await over `.then()` chains
- Controllers stay thin — business logic lives in services
- All API responses use the standard structure defined above
- Never expose `password`, `governmentID`, or `stripeCustomerID` fields in API responses
- Prisma for all database access — no raw SQL
- All routes mounted under `/api/v1/`
