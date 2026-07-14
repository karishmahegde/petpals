# 🐾 PetPals - Animal Adoption Management System

A multi-shelter pet adoption platform built as a full-stack project following real software engineering practices. PetPals goes beyond existing solutions by serving as an internal operations backbone for shelter networks, with features like inter-shelter animal transfers, a universal health passport, and an AI-powered pet-adopter compatibility matcher.

---

## ✨ Key Features

| Feature                       | Description                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------- |
| **Multi-shelter network**     | Unified animal listings and workflows across all branches of an organisation |
| **Inter-shelter transfers**   | Capacity-aware transfer requests with full transfer history                  |
| **Universal health passport** | Medical records that travel with an animal across shelter relocations        |
| **AI compatibility matcher**  | Claude-powered pet-adopter matching to improve adoption success rates        |
| **Role-based access control** | Six distinct roles: Admin, Shelter Staff, Adopter, Vet, Volunteer, Donor     |
| **Donation management**       | Stripe-integrated donor flow with impact tracking                            |

---

## 🛠️ Tech Stack

**Frontend**

- React 18 + Vite
- Tailwind CSS
- React Router v6
- Zustand (global/auth state)
- TanStack Query (server state & caching)

**Backend**

- Node.js 18 + Express
- Prisma ORM
- PostgreSQL 15 + PostGIS
- Supabase (media storage)

**Auth**

- JWT (stateless authentication)
- bcrypt (password hashing)

**Infrastructure**

- Docker + Docker Compose (local dev)
- Vercel (frontend deployment)
- Railway (backend deployment)

**Testing**

- Jest + Supertest (unit & integration)
- Cypress (E2E - critical flows only)

**AI Feature**

- OpenAI API (pet-adopter compatibility matcher, Sprint 6)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Docker + Docker Compose
- Git

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/petpals.git
cd petpals
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Fill in values in .env - see comments in the file
```

### 3a. Run with Docker (recommended)

```bash
docker-compose up --build
```

- Client → http://localhost:3000
- API → http://localhost:5000
- DB → localhost:5432

### 3b. Run manually (without Docker)

**Server**

```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

**Client**

```bash
cd client
npm install
npm run dev
```
---

## 🗂️ Project Structure

```
petpals/
├── client/                  # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── api/             # Axios API calls — axiosInstance.ts, authApi.ts
│   │   ├── assets/          # Static assets — images/ (backgrounds, branding)
│   │   ├── components/
│   │   │   ├── ui/          # Reusable primitives (buttons, inputs, cards) — Card.tsx
│   │   │   ├── layout/      # Navbar, sidebar, page shells — Navbar.tsx
│   │   │   ├── forms/       # Form components
│   │   │   ├── ProtectedRoute.tsx  # Redirects to /login if not authenticated
│   │   │   └── RoleRoute.tsx       # Redirects to /forbidden if role not permitted
│   │   ├── layouts/         # Route-level page shells — PublicLayout.tsx
│   │   ├── pages/
│   │   │   ├── adopter/
│   │   │   ├── staff/
│   │   │   ├── vet/
│   │   │   ├── volunteer/
│   │   │   ├── donor/
│   │   │   ├── admin/
│   │   │   ├── auth/        # Login.tsx, Register.tsx
│   │   │   └── errors/      # Forbidden.tsx, NotFound.tsx
│   │   ├── store/           # Zustand global state — useAuthStore.ts
│   │   ├── styles/          # index.css — Tailwind directives
│   │   ├── main.tsx	# The TypeScript entry point. React starts here
│   │   ├── App.tsx	# The root component. Defines all the routes — which URL path renders which page component.
│   │   └── vite-env.d.ts	# Vite/TypeScript ambient type declarations
│   ├── index.html	# The single HTML file for the entire React app. Uses Single Page Application (SPA)
│   ├── vite.config.ts
│   └── tailwind.config.js	# Configures Tailwind CSS
│   └── .eslintrc.cjs	    # Linting Code
│   └── Dockerfile		# Instructions for building the server's Docker container. Read top to bottom like a recipe.
│
├── server/                  # Node.js + Express REST API
│   ├── src/
│   │   ├── routes/          # Express routers (one per resource) — auth.routes.js
│   │   ├── controllers/     # Route handler logic — auth.controller.js
│   │   ├── middleware/      # Auth (JWT), RBAC, error handling — authenticate.js, authorizeRoles.js, errorHandler.js
│   │   ├── services/        # Business logic layer — auth.service.js
│   │   ├── utils/           # Shared helpers — errors.js, response.js
│   │   ├── config/          # DB and env config — prisma.js
│   │   ├── prisma/
│   │   │   ├── migrations/ # Version control migration files generated by running the Prisma migrate command
│   │   │   └── schema.prisma	# Prisma reads this file and uses it to create the PostgreSQL tables and generate the TypeScript/JavaScript client used to query the database.
│   │   │   └── seed.js # The seed database for intitial testing
│   │   ├── tests/
│   │   │   ├── unit/         # authenticate.test.js, authorizeRoles.test.js
│   │   │   └── integration/  # auth.register.test.js, auth.login.test.js, auth.logout.test.js
│   │   ├── app.js           # Builds the Express app (middleware, routes, error handler) — exported for both index.js and Supertest
│   │   └── index.js         # Entry point — imports app.js and starts the server on PORT
│   └── .env.example	# A template that lists every environment variable the project needs, with placeholder values instead of real ones. This one is committed to GitHub.
│   └── package.json		# Describes your server as a Node.js project. Lists every library it depends on and defines the commands you can run.
│   └── Dockerfile		# Instructions for building the server's Docker container. Read top to bottom like a recipe.
│
├── docs/
│   └── 01_Project_Overview.pdf
│   └── 02_Requirements.pdf
│   └── 03_Personas.pdf
│   └── 04_Database_Design.pdf
│   └── 05_API_Design.pdf
└── CLAUDE.md   # the permanent context file
└── docker-compose.yml	# Defines three "containers”: PostgreSQL, Express server, and React app. Tells Docker how to run them all together with one command: docker-compose up.
└── .gitignore	# Tells Git which files and folders to completely ignore — they will never be committed or pushed to GitHub, no matter what.
```
---

## 🗂️ Project Structure

```
petpals/
├── client/                  # React frontend (Vite + TypeScript)
│   ├── public/
│   │   └── favicon.png
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/      # Navbar, page shells
│   │   │   └── ui/          # Reusable primitives — Card.tsx, ButtonElement.tsx, etc.
│   │   ├── logic/
│   │   │   ├── api/         # Axios API calls — axiosInstance.ts, authApi.ts, petsApi.ts
│   │   │   ├── hooks/       # Shared hooks — useScrollToHash.ts, useScrollToTop.ts
│   │   │   ├── route/       # ProtectedRoute.tsx, RoleRoute.tsx
│   │   │   └── store/       # Zustand global state — useAuthStore.ts
│   │   ├── pages/
│   │   │   ├── errors/      # Forbidden.tsx, NotFound.tsx
│   │   │   ├── protected/   # Role-based dashboards — adopter, staff, vet, volunteer, donor, admin
│   │   │   └── public/      # Public marketing, auth, and catalog pages
│   │   ├── static/
│   │   │   ├── assets/      # images/ — backgrounds, branding, page imagery
│   │   │   └── content/     # Page copy/content data
│   │   ├── App.tsx          # Root component — defines all the routes
│   │   ├── index.css        # Tailwind directives
│   │   ├── main.tsx         # React entry point
│   │   └── vite-env.d.ts    # Vite/TypeScript ambient type declarations
│   ├── .env.local
│   ├── .eslintrc.cjs
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js	  # Configures Tailwind CSS
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/                  # Node.js + Express REST API
│   ├── src/
│   │   ├── config/          # DB and env config — prisma.js
│   │   ├── controllers/     # Route handler logic
│   │   ├── middleware/      # Auth (JWT), RBAC, error handling
│   │   ├── prisma/          # schema.prisma, migrations/, seed.js
│   │   ├── routes/          # Express routers (one per resource)
│   │   ├── services/        # Business logic layer
│   │   ├── tests/
│   │   │   ├── integration/ # Full request-response cycle against a real DB
│   │   │   └── unit/        # Mocked dependencies — controller/service logic in isolation
│   │   ├── utils/           # Shared helpers — errors.js, response.js
│   │   ├── app.js           # Builds the Express app — exported for both index.js and Supertest
│   │   └── index.js         # Entry point — starts the server on PORT
│   ├── .env
│   ├── .env.example	      # Template listing every environment variable the project needs — committed to GitHub
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma.config.ts
│   └── swagger.js
│
├── docs/                    # Project documentation PDFs
│
├── CLAUDE.md                # The permanent context file
├── docker-compose.yml	      # Orchestrates PostgreSQL, Express server, and React app — one command: docker-compose up
└── .gitignore
```

---

## 📡 API

Base URL: `http://localhost:5000/api/v1`

Full API documentation is available via Swagger at `/api/docs` once the server is running.

### Resource domains

| Domain                | Base path                        |
| --------------------- | -------------------------------- |
| Auth                  | `/auth`                          |
| Pets                  | `/pets`                          |
| Adopters              | `/adopters`                      |
| Adoption Applications | `/adoption-applications`         |
| Shelters              | `/shelters`                      |
| Staff                 | `/staff`                         |
| Appointments          | `/appointments`                  |
| Vaccinations          | `/appointments/:id/vaccinations` |
| Tasks                 | `/tasks`                         |
| Events                | `/events`                        |
| Donors & Donations    | `/donors`, `/donations`          |
| Shelter Transfers     | `/transfers`                     |

---

## 🧪 Testing

```bash
cd server
npm test                 # run all tests
npm run test:coverage    # with coverage report
```

```bash
cd client
npm run typecheck        # TypeScript type check
npm run lint             # ESLint
```

Target: 70% coverage across unit and integration tests. Cypress E2E is scoped to critical adoption flows only.

---

## ✏️ Prototype

Figma High Fidelity prototype: https://www.figma.com/design/dtiJqWSoBhaMrgrs12fXYK/PetPals

## 🗄️ Database

The schema is defined in `server/src/prisma/schema.prisma` and covers 26 tables across all six user roles.

ER Diagram: https://dbdiagram.io/d/PetPals-69bf5ca6fb2db18e3bd4b303

---

## 📄 Documentation

All project documentation lives in the `docs/` folder:

- `01_Project Overview.pdf`
- `02_Requirements.pdf`
- `03_Personas.pdf`
- `04_Database Design.pdf`
- `05_API Design.pdf`
- `06_Auth System.pdf`

---

## 👤 Author

Built by [Karishma Hegde ✨](https://karishmahegde.netlify.app)
