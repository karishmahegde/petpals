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
| **AI compatibility matcher**   | Personality quiz + rule scoring, refined by an LLM (Groq or any OpenAI-compatible provider) with a short reason per match; falls back to rule-only scores without AI |
| **AI health-passport summary** | One-click summary of a pet's medical history for staff and vets, with points to review that link to the records they cite |
| **Role-based access control**  | Six distinct roles: Admin, Shelter Staff, Adopter, Veterinarian, Volunteer, Donor |
| **Geospatial shelter search**  | PostGIS-powered "find shelters near me" with radius filtering                     |
| **Two-token JWT auth**         | Short-lived access token + httpOnly refresh cookie, with post-login redirect-back |
| **Email & account security**   | Email verification, password reset, self-service reactivation and email change by emailed link, plus account and review notices (Brevo, optional) |
| **Live in-app notifications**  | 28 event types across all six roles, pushed in real time over Server-Sent Events — bell with unread badge, a Notifications page, and an optional chime |
| **Stripe-backed applications** | Adoption applications gated behind a $15 Checkout session                         |
| **Donation management**        | Stripe-integrated donor flow with impact tracking                                 |

## 🟤 Tech Stack

### Frontend

![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) ![Zustand](https://img.shields.io/badge/Zustand-593D88?style=flat-square) ![TanStack Query](https://img.shields.io/badge/TanStack_Query-FF4154?style=flat-square&logo=reactquery&logoColor=white)

### Backend

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white) ![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=flat-square&logo=stripe&logoColor=white) ![Brevo](https://img.shields.io/badge/Brevo-0B996E?style=flat-square&logo=brevo&logoColor=white) ![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=flat-square&logo=swagger&logoColor=black)

### Database

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![PostGIS](https://img.shields.io/badge/PostGIS-4169E1?style=flat-square) ![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)

### Auth

![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white) ![bcrypt](https://img.shields.io/badge/bcrypt-338033?style=flat-square)

### AI

![Groq](https://img.shields.io/badge/Groq-F55036?style=flat-square)

### Testing

![Jest](https://img.shields.io/badge/Jest-C21325?style=flat-square&logo=jest&logoColor=white) ![Supertest](https://img.shields.io/badge/Supertest-323330?style=flat-square) ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white) ![Testing Library](https://img.shields.io/badge/Testing_Library-E33332?style=flat-square&logo=testinglibrary&logoColor=white) ![Cypress](https://img.shields.io/badge/Cypress-17202C?style=flat-square&logo=cypress&logoColor=white)

### Infrastructure

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) ![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white) ![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white)

### Tooling

![Figma](https://img.shields.io/badge/Figma-F24E1E?style=flat-square&logo=figma&logoColor=white)

## 🔶 Getting Started

### Prerequisites

- **Node.js 18+** and **Git**
- **Docker + Docker Compose** _(Option B only)_
- A free **[Supabase](https://supabase.com)** account — the project's database (Postgres + PostGIS) and file storage both run on it, even in local dev

### Option A: Local Setup (recommended)

```bash
# 1. Clone the repo
git clone https://github.com/karishmahegde/petpals.git
cd petpals

# 2. Configure the server — fill in your Supabase / JWT (/ optional Stripe) values,
#    plus the optional Groq AI values (AI_BASE_URL / AI_API_KEY / AI_MODEL; leave them
#    blank to run without AI — see setup/SETUP.md "AI features (optional)"), and the
#    optional Brevo email values (EMAIL_API_KEY / EMAIL_FROM; leave them blank and
#    every email prints to the server terminal — see setup/SETUP.md "Email (optional)")
cd server
npm install
cp .env.example .env

# 3. Build the database, create the storage buckets, upload the seed photos, load sample data
npm run setup

# 4. Configure the client
cd ../client
npm install
echo "VITE_API_URL=http://localhost:5000/api/v1" > .env.local
```

Then start both dev servers:

```bash
# Terminal 1
cd server && npm run dev      # → http://localhost:5000

# Terminal 2
cd client && npm run dev      # → http://localhost:3000
```

Log in with any of the seeded test accounts, e.g. `adopter@petpals.com` / `Adopter@123`.

**[`setup/SETUP.md`](./setup/SETUP.md)** is the full guide: where to find each Supabase value, what `npm run setup` does, the complete test-account list, and troubleshooting.

> ⚠️ `npm run setup` is for **first-time setup only** — its last step re-seeds, which wipes the database. Afterwards, re-seed with `npx prisma db seed`.

### Option B: Docker

Runs the API and client in containers against your Supabase project — the database and file storage stay on Supabase, configured through `server/.env`.

```bash
# 1. Configure the server — same values as Option A
cp server/.env.example server/.env

# 2. One-time: build the database, storage buckets and sample data
cd server && npm install && npm run setup && cd ..

# 3. Build and start the API and client
docker-compose up --build
```

| Service | URL                   |
| ------- | --------------------- |
| Client  | http://localhost:3000 |
| API     | http://localhost:5000 |

---

## 🟤 Project Structure

Top-level layout of the repository:

```text
petpals/
├── client/                # React + Vite + TypeScript frontend
├── server/                # Node.js + Express REST API (Prisma + PostgreSQL)
├── setup/                 # ⭐ Everything needed to get the project running locally
│   ├── SETUP.md           #    Step-by-step setup guide (start here)
│   ├── setup-storage.js   #    Creates storage buckets + uploads seed photos (run by `npm run setup`)
│   ├── pet-images/        #    Seed pet photos, one per seeded pet
│   ├── government-ids/    #    Sample ID documents for the seeded ID verifications
│   └── placeholder.jpg    #    Photo a new pet shows until staff upload one
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
| Vaccinations          | `/vaccines`, `/appointments/:id/vaccinations` |
| Health records        | `/health-records`, `/pets/:id/health-records` |
| Veterinarians         | `/vets`                          |
| Volunteers            | `/volunteers`                    |
| Government IDs        | `/government-ids`                |
| AI matcher            | `/match-quiz`, `/adopters/me/matches` |
| Admin                 | `/admins`, `/analytics`          |
| Tasks                 | `/tasks`                         |
| Events                | `/events`                        |
| Donors & Donations    | `/donors`, `/donations`          |
| Shelter Transfers     | `/transfers`                     |
| Notifications         | `/notifications` (+ `/notifications/stream`, SSE) |

## 🟤 Testing

| Layer | Tool | What it covers |
| --- | --- | --- |
| Server unit | Jest + Supertest | Every route, controller and service with Prisma, Stripe, storage, AI and email mocked — 2,100+ tests, **95% lines / 86% branches** |
| Server integration | Jest + Supertest | One journey per sprint against the real database, creating and removing its own data |
| Client | Vitest + React Testing Library | Routing and auth logic, password rules, the live notification stream, and the components that guard the adoption flow |
| End-to-end | Cypress | The critical adoption flows in a real browser: login redirect-back, the email-verification gate, applying up to the Stripe hand-off + withdrawing, and a visit confirmed by staff reaching the adopter's bell live |

```bash
# server/
npm run test:unit          # unit tests + coverage; fails below 80% lines / 70% branches
npm run test:integration   # against the database in server/.env
npm run test:leftovers     # read-only report of any test data left behind

# client/
npm test                   # Vitest
npm run typecheck && npm run lint
npm run cypress:open       # needs both dev servers running (cypress:run for headless)
```

**CI:** GitHub Actions runs the server unit tests (with the coverage gate) and the client typecheck, lint and Vitest on every pull request into `dev` and `main`; both are required checks. Integration and Cypress run locally — they need the database and the dev servers. See [`setup/SETUP.md`](./setup/SETUP.md#running-the-tests) for what each needs.

## 🔶 License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for details.

---

<div align="center">
Made with 🐾 by <a href="https://github.com/karishmahegde">Karishma</a>
</div>
