<div align="center">

<img src="./docs/assets/petpals.gif" alt="PetPals banner - a multi-shelter animal adoption platform" width="15%" />

# PetPals

**A unified, multi-shelter Animal Adoption Management System**

[![CI](https://img.shields.io/github/actions/workflow/status/karishmahegde/petpals/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/karishmahegde/petpals/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/karishmahegde/petpals/badges/coverage.json&style=flat-square)](./server/jest.config.js)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](./LICENSE)

</div>

Connecting shelters, adopters, vets, volunteers, and donors on one platform with inter-shelter animal transfers, a universal pet health passport, and AI-powered adopter matching.

<div align="center">

[![Live site](https://img.shields.io/badge/🌐_Live_site-petpals--adopt.vercel.app-000000?style=flat-square&logo=vercel&logoColor=white)](https://petpals-adopt.vercel.app)
[![API docs](https://img.shields.io/badge/📖_API_docs-Swagger-85EA2D?style=flat-square&logo=swagger&logoColor=black)](https://petpals-api.onrender.com/api/docs)

</div>

## About the Project

Animal shelters typically operate in isolation. Each branch manages intake, adoptions, and medical records separately, with no shared visibility across locations. Animals get overlooked, applications get lost, and adopters face inconsistent experiences depending on which shelter they contact.

**PetPals** unifies multiple shelters into one network: a shared animal catalog, capacity-aware inter-shelter transfers, and a health passport that follows each animal between locations. Role-specific dashboards, an AI adopter matcher, and real-time notifications are all powered by a server layer designed for data integrity, RBAC and graceful degradation when optional services are unavailable.

Documented REST API (Swagger), 2,100+ automated tests, and PR-gated CI with auto-deploy. Security by design: in-memory access tokens, payments recorded only after Stripe’s webhook confirms them, and government IDs served only through short-lived signed URLs. Designed in Figma before implementation.

Detailed documentation for every feature, from the database and API design to the AI features, notifications, testing and security, is in [`docs/`](./docs).

## Live Demo

<p align="center">
  <img src="./docs/assets/demo.gif" alt="Demo: an adopter searches by ZIP code, gets AI matches, applies and pays; shelter staff approve, and the adopter is notified live" width="900" />
</p>

<p align="center"><sub>Search by ZIP code → AI matches → apply and pay (Stripe test mode) → shelter staff approve → the adopter is notified live.</sub></p>

The live site (linked above) is a portfolio demo. The demo logins below are shared, so anything you do with them is visible to the next visitor; their password, email and account can't be changed. Please don't enter real personal details or upload a real ID.

<details>
<summary><b>Demo logins</b></summary>

| Role      | Email                   | Password        |
| --------- | ----------------------- | --------------- |
| Adopter   | `adopter@petpals.com`   | `Adopter@123`   |
| Volunteer | `volunteer@petpals.com` | `Volunteer@123` |
| Donor     | `donor@petpals.com`     | `Donor@123`     |

<sub>Admin, Staff and Vet logins are available on request.</sub>

</details>

## Screenshots

<table>
  <tr>
    <td width="50%" valign="top">
      <a href="./docs/assets/screenshots/01-pet-catalog.png"><img src="./docs/assets/screenshots/01-pet-catalog.png" alt="Public pet catalog" /></a>
      <br /><b>Public pet catalog</b><br /><sub>Every shelter's animals in one catalog, filtered by species, breed, size, age, shelter and distance.</sub>
    </td>
    <td width="50%" valign="top">
      <a href="./docs/assets/screenshots/02-admin-overview.png"><img src="./docs/assets/screenshots/02-admin-overview.png" alt="Admin overview" /></a>
      <br /><b>Admin overview</b><br /><sub>Network-wide numbers, monthly intake and adoptions, shelters and capacity alerts.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="./docs/assets/screenshots/03-ai-health-passport.png"><img src="./docs/assets/screenshots/03-ai-health-passport.png" alt="Health passport with AI summary" /></a>
      <br /><b>Health passport with AI summary</b><br /><sub>A vet's view of Rocky's passport: the AI summary with points to review, each linked to the record it cites.</sub>
    </td>
    <td width="50%" valign="top">
      <a href="./docs/assets/screenshots/04-transfers.png"><img src="./docs/assets/screenshots/04-transfers.png" alt="Inter-shelter transfers" /></a>
      <br /><b>Inter-shelter transfers</b><br /><sub>Incoming and outgoing transfers between branches, with the approve / decline panel.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="./docs/assets/screenshots/05-donations.png"><img src="./docs/assets/screenshots/05-donations.png" alt="Donation history" /></a>
      <br /><b>Donation history</b><br /><sub>A donor's Stripe donations across shelters, with totals per shelter.</sub>
    </td>
    <td width="50%" valign="top">
      <a href="./docs/assets/screenshots/06-volunteer-overview.png"><img src="./docs/assets/screenshots/06-volunteer-overview.png" alt="Volunteer dashboard" /></a>
      <br /><b>Volunteer dashboard</b><br /><sub>Assigned tasks, upcoming events and the appointments they're assisting.</sub>
    </td>
  </tr>
</table>

## Key Features

| Feature                        | Description                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------- |
| **Multi-shelter network**      | One catalog and shared workflows across every branch                             |
| **Inter-shelter transfers**    | Capacity-aware transfers with full history                                       |
| **Universal health passport**  | Medical records that follow an animal from shelter to shelter                    |
| **AI compatibility matcher**   | Personality quiz + rule scoring, refined by an LLM with a reason per match       |
| **AI health-passport summary** | One-click medical summary, with points to review linked to records               |
| **Role-based access control**  | Six roles: Admin, Shelter Staff, Adopter, Veterinarian, Volunteer, Donor         |
| **Geospatial shelter search**  | PostGIS "shelters near me" with a radius filter                                  |
| **Email & account security**   | Verification, password reset, reactivation and email change by link              |
| **Live notifications**         | 28 event types pushed in real time over Server-Sent Events                       |
| **Stripe payments**            | Application fees and shelter donations through Stripe Checkout                   |
| **Security by design**         | Rate limits, hashed single-use links, a daily AI cap - see [Security](#security) |

## Architecture

<p align="center">
  <a href="./docs/assets/architecture.png"><img src="./docs/assets/architecture.png" alt="PetPals system architecture: React client on Vercel, /api rewrite proxy to the Express API on Render (Docker), Supabase Postgres + PostGIS and storage, with Stripe, Groq and Brevo as external services" width="700" /></a>
</p>

- **Client (Vercel):** a React single-page app. Zustand holds the session, with the access token kept in memory only, and TanStack Query manages all server data and caching.
- **Request path:** REST calls go through Vercel's `/api` rewrite, so the refresh-token cookie stays on the site's own domain. The live notification stream (Server-Sent Events) connects to Render directly, so no proxy can buffer it.
- **API (Render, Docker):** Express with two-token JWT auth, role checks on every route for the six roles, and rate limits. All database access goes through Prisma, and the API is documented in Swagger.
- **Data (Supabase):** Postgres with PostGIS for the nearby-shelter search. Pet photos are public in Storage; government IDs are private and served only through short-lived signed URLs.
- **External services:**
  - **Stripe:** an application or donation is recorded only when Stripe's webhook confirms the payment.
  - **Groq:** powers the AI matcher and health-passport summaries, under a daily call cap, falling back to rule-based scores.
  - **Brevo:** sends transactional email over its HTTPS API, or prints it to the console when not configured.
- **Delivery:** GitHub Actions runs CI on every PR, and merges to `main` auto-deploy both hosts. UptimeRobot keeps the free API from sleeping.

## Tech Stack

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

![Jest](https://img.shields.io/badge/Jest-C21325?style=flat-square&logo=jest&logoColor=white) ![Supertest](https://img.shields.io/badge/Supertest-323330?style=flat-square) ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white) ![Cypress](https://img.shields.io/badge/Cypress-17202C?style=flat-square&logo=cypress&logoColor=white)

### Infrastructure

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) ![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white) ![Render](https://img.shields.io/badge/Render-000000?style=flat-square&logo=render&logoColor=white) ![UptimeRobot](https://img.shields.io/badge/UptimeRobot-3BD671?style=flat-square&logo=uptimerobot&logoColor=white)

### Tooling

[![Figma](https://img.shields.io/badge/Figma-F24E1E?style=flat-square&logo=figma&logoColor=white)](https://www.figma.com/design/dtiJqWSoBhaMrgrs12fXYK/PetPals)

## Getting Started

- **Node.js 22** and **Git**
- A free **[Supabase](https://supabase.com)** project (database + file storage)
- _Optional:_ Stripe, Groq and Brevo keys for payments, AI and email; the app runs without them

Follow **[`setup/SETUP.md`](./setup/SETUP.md)** to run PetPals locally with sample data covering every role. It also covers the optional services, test accounts, running the tests, troubleshooting and Docker Compose.

---

## Project Structure

Top-level layout of the repository:

```text
petpals/
├── client/                # React + Vite + TypeScript frontend
├── server/                # Node.js + Express REST API (Prisma + PostgreSQL)
├── setup/                 # Everything needed to get the project running locally
│   ├── SETUP.md           #    Step-by-step setup guide (start here)
│   ├── setup-storage.js   #    Creates storage buckets + uploads seed photos (run by `npm run setup`)
│   ├── pet-images/        #    Seed pet photos, one per seeded pet
│   ├── government-ids/    #    Sample ID documents for the seeded ID verifications
│   └── placeholder.jpg    #    Photo a new pet shows until staff upload one
├── .github/workflows/     # GitHub Actions CI (server unit tests + client checks on every PR)
├── docs/                  # Project documentation PDFs (design, API references, features, testing, security)
├── docker-compose.yml     # Runs the API + client in containers against Supabase - `docker compose up`
├── render.yaml            # Render Blueprint for the hosted API (free plan)
├── CLAUDE.md              # Full architecture, API, and conventions reference
├── LICENSE
└── README.md              # You are here
```

## API Reference

Interactive Swagger/OpenAPI docs:

- **Production:** [petpals-api.onrender.com/api/docs](https://petpals-api.onrender.com/api/docs)
- **Local:** `http://localhost:5000/api/docs` (once the server is running)

### Resource domains

All paths sit under `/api/v1`.

| Domain                    | Base path                                         |
| ------------------------- | ------------------------------------------------- |
| Auth                      | `/auth`                                           |
| Pets (public catalog)     | `/pets`, `/species`, `/breeds`                    |
| Shelters                  | `/shelters`                                       |
| Adopters                  | `/adopters`                                       |
| Adoption Applications     | `/adoption-applications`                          |
| Visits                    | `/visits`                                         |
| Staff operations          | `/staff`                                          |
| Appointments              | `/appointments`                                   |
| Vaccinations              | `/vaccines`, `/appointments/:id/vaccinations`     |
| Health records            | `/health-records`, `/pets/:id/health-records`     |
| Veterinarians             | `/vets`                                           |
| Volunteers                | `/volunteers`                                     |
| Government IDs            | `/government-ids`                                 |
| AI matcher                | `/match-quiz`, `/adopters/me/matches`             |
| AI passport summary       | `/pets/:id/health-passport/summary`               |
| Admin                     | `/admins`, `/analytics`                           |
| Tasks                     | `/tasks`                                          |
| Events                    | `/events`                                         |
| Donors & Donations        | `/donors`, `/donations`                           |
| Shelter Transfers         | `/transfers`                                      |
| Notifications             | `/notifications` (+ `/notifications/stream`, SSE) |
| Payments (Stripe webhook) | `/webhooks/stripe`                                |

## Testing

| Layer              | Tool                           | What it covers                                                                                                                                                                                                     |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server unit        | Jest + Supertest               | Every route, controller and service with Prisma, Stripe, storage, AI and email mocked - 2,100+ tests, gated at 80% lines / 70% branches (current figure in the coverage badge)                                     |
| Server integration | Jest + Supertest               | One journey per sprint against the real database, creating and removing its own data                                                                                                                               |
| Client             | Vitest + React Testing Library | Routing and auth logic, password rules, the live notification stream, and the components that guard the adoption flow                                                                                              |
| End-to-end         | Cypress                        | The critical adoption flows in a real browser: login redirect-back, the email-verification gate, applying up to the Stripe hand-off + withdrawing, and a visit confirmed by staff reaching the adopter's bell live |

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

Unit tests, typecheck, lint and Vitest also run in CI on every PR; integration and Cypress run locally - they need the database and the dev servers. See [`setup/SETUP.md`](./setup/SETUP.md#running-the-tests) for what each needs.

## Engineering Practices

- **Design first:** all screens designed in Figma before implementation. [View designs](https://www.figma.com/design/dtiJqWSoBhaMrgrs12fXYK/PetPals)
- **Sprints with specs:** 12 sprints planned on a Trello board; every feature has a written spec or design doc in [`docs/`](./docs).
- **Branching:** `feature/sprint-N` → `dev` → `main`, with `dev` and `main` changed only through pull requests.
- **PR-gated CI:** GitHub Actions runs the server unit tests (coverage gate 80% lines / 70% branches) and the client typecheck, lint and Vitest on every pull request; both are required checks.
- **Recorded decisions:** API documented in Swagger, schema changes as versioned migrations, and every security decision with its reasons and limits in the [Security Design document](./docs/19-Security%20Design.pdf).

## Deployment

PetPals runs entirely on free tiers, so hosting it costs nothing.

| Part                    | Host                                          | URL                                                                   |
| ----------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| Client                  | **Vercel** (Hobby)                            | [petpals-adopt.vercel.app](https://petpals-adopt.vercel.app)          |
| API                     | **Render** (free web service)                 | [petpals-api.onrender.com](https://petpals-api.onrender.com/api/docs) |
| Database + file storage | **Supabase** (free)                           | -                                                                     |
| Payments · email · AI   | **Stripe** (test mode) · **Brevo** · **Groq** | -                                                                     |
| Uptime monitoring       | **UptimeRobot** (free)                        | -                                                                     |

**_To deploy your own copy, follow [`setup/SETUP.md`](./setup/SETUP.md#deploying-your-own-copy)._**

## Security

Designed in from the start and hardened before launch. Every decision is detailed in the **[Security Design document](./docs/19-Security%20Design.pdf)**.

- **Sessions:** bcrypt passwords; short-lived access token in memory, refresh token in an `httpOnly`, `SameSite=Strict` cookie
- **Access control:** role checks on every endpoint; users see only their own data, staff only their shelter's
- **Emailed links:** single-use, short-lived and stored only as a hash
- **Abuse protection:** rate limits on login, sign-up, emailed links and AI, plus an app-wide daily AI cap; the shared demo logins can't have their password, email or account changed
- **Data protection:** government IDs in private storage behind short-lived signed links; sensitive fields never returned
- **Payments:** handled by Stripe Checkout, with verified webhook signatures

## License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for details.

---

<div align="center">
Made with 🐾 by <a href="https://github.com/karishmahegde">Karishma</a>
</div>
