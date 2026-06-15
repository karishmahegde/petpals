# 🐾 PetPals — Animal Adoption Management System

A multi-shelter pet adoption platform built as a full-stack learning project following real software engineering practices. PetPals goes beyond existing solutions by serving as an internal operations backbone for shelter networks, with features like inter-shelter animal transfers, a universal health passport, and an AI-powered pet-adopter compatibility matcher.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Multi-shelter network** | Unified animal listings and workflows across all branches of an organisation |
| **Inter-shelter transfers** | Capacity-aware transfer requests with full transfer history |
| **Universal health passport** | Medical records that travel with an animal across shelter relocations |
| **AI compatibility matcher** | Claude-powered pet-adopter matching to improve adoption success rates |
| **Role-based access control** | Six distinct roles: Admin, Shelter Staff, Adopter, Vet, Volunteer, Donor |
| **Donation management** | Stripe-integrated donor flow with impact tracking |

---

## 🗂️ Project Structure

```
petpals/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/          # Reusable primitives (buttons, inputs, cards)
│   │   │   ├── layout/      # Navbar, sidebar, page shells
│   │   │   └── forms/       # Form components
│   │   ├── pages/
│   │   │   ├── adopter/
│   │   │   ├── staff/
│   │   │   ├── vet/
│   │   │   ├── volunteer/
│   │   │   ├── donor/
│   │   │   ├── admin/
│   │   │   └── auth/
│   │   ├── hooks/           # Custom React hooks
│   │   ├── store/           # Zustand global state
│   │   ├── services/        # Axios API calls
│   │   ├── utils/           # Helpers and constants
│   │   └── styles/
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── server/                  # Node.js + Express REST API
│   ├── src/
│   │   ├── routes/          # Express routers (one per resource)
│   │   ├── controllers/     # Route handler logic
│   │   ├── middleware/       # Auth (JWT), RBAC, error handling
│   │   ├── services/        # Business logic layer
│   │   ├── utils/           # Shared helpers
│   │   ├── config/          # DB and env config
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── index.js         # Entry point
│   └── tests/
│       ├── unit/
│       └── integration/
│
├── docker-compose.yml
├── .env.example
└── .gitignore
```

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
- Cypress (E2E — critical flows only)

**AI Feature**
- Anthropic Claude API (pet-adopter compatibility matcher, Sprint 6)

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
# Fill in values in .env — see comments in the file
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

## 📡 API

Base URL: `http://localhost:5000/api/v1`

Full API documentation is available via Swagger at `/api/docs` once the server is running.

### Resource domains

| Domain | Base path |
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
| Donors & Donations | `/donors`, `/donations` |
| Shelter Transfers | `/transfers` |

---

## 🗓️ Sprint Plan

| Sprint | Focus |
|---|---|
| 1 | Auth + project setup |
| 2 | Pet management (CRUD, photos, search) |
| 3 | Adoption flow (applications, visits, notifications) |
| 4 | Shelter staff & admin operations |
| 5 | Vet, volunteer, donor flows |
| 6 | AI compatibility matcher (Claude API) |
| 7 | Testing + coverage to 70% |
| 8 | Deployment, polish, final report |

---

## 🧪 Testing

```bash
cd server
npm test                 # run all tests
npm run test:coverage    # with coverage report
```

Target: 70% coverage across unit and integration tests. Cypress E2E is scoped to critical adoption flows only.

---

## 🗄️ Database

The schema is defined in `server/src/prisma/schema.prisma` and covers 26 tables across all six user roles.

ER Diagram: https://dbdiagram.io/d/PetPals-69bf5ca6fb2db18e3bd4b303

---

## 📄 Documentation

All project documentation lives in the `docs/` folder (not committed to version control — maintained locally):

- `01_Project_Overview.docx`
- `02_Requirements.docx`
- `03_API_Design.docx`
- `04_Database_Design.docx`

---

## 👤 Author

Built by Karishma as a solo full-stack learning project.
