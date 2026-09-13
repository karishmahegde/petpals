# PetPals

**A unified, multi-shelter Animal Adoption Management System**

<div align="center">
<img src="./docs/assets/petpals.gif" alt="PetPals banner — a multi-shelter animal adoption platform" width="20%" /> 
</div>

Connecting shelters, adopters, vets, volunteers, and donors on one platform with inter-shelter animal transfers, a universal pet health passport, and AI-powered adopter matching.

<!-- Badges -->

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](./LICENSE)

## 🟤 About the Project

Animal shelters typically operate in isolation. Each branch manages intake, adoptions, and medical records separately, with no shared visibility across locations. Animals get overlooked, applications get lost, and adopters face inconsistent experiences depending on which shelter they contact.

**PetPals** is a full-stack Animal Adoption Management System designed to unify multiple shelters into a single collaborative network. It was built using production-quality engineering tools, frameworks and practices end-to-end including user-focused design, sprint-based delivery, formal specs, API documentation, automated testing, and CI/CD.

## 🔶 Key Features

| Feature                        | Description                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------- |
| **Multi-shelter network**      | Unified animal listings and workflows across all branches of an organisation      |
| **Inter-shelter transfers**    | Capacity-aware transfer requests with full transfer history                       |
| **Universal health passport**  | Medical records that travel with an animal across shelter relocations             |
| **AI compatibility matcher**   | OpenAI-powered pet–adopter matching to improve adoption success rates _(planned)_ |
| **Role-based access control**  | Six distinct roles: Admin, Shelter Staff, Adopter, Veterinarian, Volunteer, Donor |
| **Geospatial shelter search**  | PostGIS-powered "find shelters near me" with radius filtering                     |
| **Two-token JWT auth**         | Short-lived access token + httpOnly refresh cookie, with post-login redirect-back |
| **Stripe-backed applications** | Adoption applications gated behind a $15 Checkout session                         |
| **Donation management**        | Stripe-integrated donor flow with impact tracking _(planned)_                     |

## 🟤 Tech Stack

### Frontend

![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) ![Zustand](https://img.shields.io/badge/Zustand-593D88?style=flat-square) ![TanStack Query](https://img.shields.io/badge/TanStack_Query-FF4154?style=flat-square&logo=reactquery&logoColor=white)

### Backend

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white) ![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=flat-square&logo=stripe&logoColor=white) ![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=flat-square&logo=swagger&logoColor=black)

### Database

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![PostGIS](https://img.shields.io/badge/PostGIS-4169E1?style=flat-square) ![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)

### Auth

![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white) ![bcrypt](https://img.shields.io/badge/bcrypt-338033?style=flat-square)

### AI

![OpenAI](https://img.shields.io/badge/OpenAI_API-412991?style=flat-square&logo=openai&logoColor=white)

### Testing

![Jest](https://img.shields.io/badge/Jest-C21325?style=flat-square&logo=jest&logoColor=white) ![Supertest](https://img.shields.io/badge/Supertest-323330?style=flat-square) ![Cypress](https://img.shields.io/badge/Cypress-17202C?style=flat-square&logo=cypress&logoColor=white)

### Infrastructure

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) ![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white) ![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white)

### Tooling

![Figma](https://img.shields.io/badge/Figma-F24E1E?style=flat-square&logo=figma&logoColor=white)

## 🔶 Getting Started

### Prerequisites

- **Node.js 18+** and **Git**
- **Docker + Docker Compose** _(Option A only)_
- A free **[Supabase](https://supabase.com)** account — the project's database (Postgres + PostGIS) and file storage both run on it, even in local dev

### Option A: Quick Start with Docker - to run the app end-to-end without installing Node locally.

```bash
# 1. Clone the repo
git clone https://github.com/karishmahegde/petpals.git
cd petpals

# 2. Copy the env template and fill in your Supabase / JWT / Stripe values
cp server/.env.example server/.env

# 3. Build and start everything (Postgres, API, client) in one command
docker-compose up --build
```

| Service              | URL                   |
| -------------------- | --------------------- |
| Client               | http://localhost:3000 |
| API                  | http://localhost:5000 |
| DB (local container) | localhost:5432        |

> ⚠️ The bundled Docker Postgres container does **not** include PostGIS or object storage — features like "nearby shelters" search and photo/ID uploads need `DATABASE_URL` pointed at Supabase regardless of whether you use Docker for the app containers. See [`setup/SETUP.md`](./setup/SETUP.md) for the full explanation.

### Option B: Local Contributor Setup

```bash
# 1. Clone the repo
git clone https://github.com/karishmahegde/petpals.git
cd petpals
```

Then follow **[`setup/SETUP.md`](./setup/SETUP.md)** end-to-end, which covers:

1. Creating a free Supabase project (database + file storage)
2. Configuring `server/.env` and `client/.env.local`
3. Applying the Prisma schema (`prisma migrate deploy` — **never** `migrate dev`, see the guide for why)
4. Running the one-time SQL script for PostGIS / generated columns / storage buckets
5. Seeding sample data — prints 6 ready-to-use test logins (Admin, Staff, Vet, Adopter, Volunteer, Donor)
6. Starting the server and client dev servers

Once both are running:

```bash
# Terminal 1
cd server && npm run dev      # → http://localhost:5000

# Terminal 2
cd client && npm run dev      # → http://localhost:3000
```
---

## 🟤 Project Structure

Top-level layout of the repository:

```text
petpals/
├── client/                # React + Vite + TypeScript frontend
├── server/                # Node.js + Express REST API (Prisma + PostgreSQL)
├── setup/                 # ⭐ Everything needed to get the project running locally
│   ├── SETUP.md           #    Step-by-step setup guide (start here)
│   └── manual-constraints.sql  # One-time SQL for PostGIS / hand-applied DB pieces
├── docs/                  # Project documentation (design PDFs, diagrams, screenshots)
├── docker-compose.yml     # Orchestrates Postgres + server + client — `docker-compose up`
├── CLAUDE.md              # Full architecture, API, and conventions reference
├── LICENSE
└── README.md              # You are here
```

## 🔶 API Reference

Base URL (dev): `http://localhost:5000/api/v1`

Interactive Swagger/OpenAPI docs are served at **`/api/docs`** once the server is running.

### Resource domains

| Domain                | Base path                        |
| --------------------- | -------------------------------- |
| Auth                  | `/auth`                          |
| Pets (public catalog) | `/pets`, `/species`, `/breeds`   |
| Shelters              | `/shelters`                      |
| Adopters              | `/adopters`                      |
| Adoption Applications | `/adoption-applications`         |
| Visits                | `/visits`                        |
| Staff operations      | `/staff`                         |
| Appointments          | `/appointments`                  |
| Vaccinations          | `/appointments/:id/vaccinations` |
| Tasks                 | `/tasks`                         |
| Events                | `/events`                        |
| Donors & Donations    | `/donors`, `/donations`          |
| Shelter Transfers     | `/transfers`                     |

## 🟤 Testing

- **Unit & Integration:** Jest + Supertest (`server/tests/`)
- **End-to-End:** Cypress (`e2e/`)

```bash
npm run test --prefix server
npm run test:e2e
```

> Note: Jest's `.toBe()` checks reference equality; `.toEqual()` checks deep value equality — use `.toEqual()` when comparing objects/arrays.

## 🔶 License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for details.

---

<div align="center">
Made with 🐾 by <a href="https://github.com/your-username">Karishma</a>
</div>
