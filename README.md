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
