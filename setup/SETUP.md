# Setup Guide

Gets you from `git clone` to a running PetPals instance with 6 test logins (one per role), 2 shelters, and 17 pets. ~15 minutes, most of it waiting on installs.

For architecture, folder structure, and API reference, see [`CLAUDE.md`](../CLAUDE.md). This file only covers first-time setup. Everything setup-related — this guide and the one-time SQL script it walks you through — lives in this `setup/` folder.

## Prerequisites

- **Node.js 18+** and **Git**
- A free **[Supabase](https://supabase.com)** account — used for the Postgres+PostGIS database *and* file storage (pet photos, ID uploads). The project needs both, so this guide uses Supabase for local dev too instead of a plain local Postgres, to avoid setting up PostGIS and a storage backend separately.
- *(Optional)* A **Stripe** test-mode account — only needed if you want the adoption-application payment flow to complete end-to-end. Everything else works without it; leave the Stripe env vars blank and skip that part.

## 1. Clone the repo

```bash
git clone <your-fork-or-repo-url> petpals
cd petpals
```

## 2. Create a Supabase project

1. [supabase.com](https://supabase.com) → **New project**. Any name/region/DB password works. Takes ~2 minutes to provision.
2. **Project Settings → Data API** → copy the **Project URL** and the **`anon` public key** and **`service_role` key**.
3. **Project Settings → Database → Connection string** → copy the **URI** (Direct connection, not the pgbouncer/pooled one — Prisma's migration step needs a direct connection).

You now have everything the server needs: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY` (the anon key), `SUPABASE_SERVICE_ROLE_KEY`.

## 3. Set up the server

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the Direct connection URI from step 2 |
| `SUPABASE_URL` | Project URL from step 2 |
| `SUPABASE_KEY` | `anon` public key from step 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key from step 2 |
| `JWT_SECRET` | any random string — generate one with `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | leave the placeholders if skipping payments |
| `CLIENT_URL` | `http://localhost:3000` (default is fine) |

`PORT`, `NODE_ENV`, and `JWT_EXPIRES_IN` can stay at their defaults. Ignore `VITE_API_BASE_URL` in this file — that one belongs to the client, configured separately in step 5.

### Build the schema

```bash
npx prisma generate
npx prisma migrate deploy
```

> ⚠️ **Use `migrate deploy`, not `migrate dev`, and not the `npm run prisma:migrate` script** (that script literally runs `migrate dev`). This schema has hand-applied PostGIS/generated columns that aren't in Prisma's migration history — `migrate dev` will detect that as drift and offer to reset your database. `migrate deploy` just applies the tracked migrations and never prompts. Full explanation in `CLAUDE.md` → Permanent Known Issues.

### Apply the hand-applied pieces (one-time)

A handful of things aren't expressible in a Prisma migration at all — a PostGIS geography column, three human-readable reference codes (`PE000002`, `APP-00048`, `APT-00123`) backed by Postgres generated columns, a partial unique index, and the two storage buckets. They're bundled into one script:

1. Open **Supabase → SQL Editor → New query**.
2. Paste in the contents of [`manual-constraints.sql`](./manual-constraints.sql) (in this same `setup/` folder) and run it.

It's idempotent, so re-running it later (e.g. after a DB reset) is safe.

### Seed sample data

```bash
npx prisma db seed
```

Creates 2 shelters, species/breeds, 17 pets, and one login per role. The command prints all 6 logins when it finishes — you'll also find them in the [Test accounts](#test-accounts) table below.

## 4. Start the server

```bash
npm run dev
```

Runs at `http://localhost:5000`. Leave this terminal running.

## 5. Set up and start the client

In a **new terminal**:

```bash
cd client
npm install
echo "VITE_API_BASE_URL=http://localhost:5000/api/v1" > .env.local
npm run dev
```

Runs at `http://localhost:3000`.

## 6. Log in

<a id="test-accounts"></a>

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@petpals.com` | `Admin@123` |
| Shelter Staff | `staff@petpals.com` | `Staff@123` |
| Veterinarian | `vet@petpals.com` | `Vet@123` |
| Adopter | `adopter@petpals.com` | `Adopter@123` |
| Volunteer | `volunteer@petpals.com` | `Volunteer@123` |
| Donor | `donor@petpals.com` | `Donor@123` |

Only the **Adopter** dashboard is built so far (see `CLAUDE.md` → Sprint Plan — Sprint 3 is in progress; Staff/Vet/Volunteer/Donor/Admin dashboards are planned). The public site (home, catalog, pet details) and Adopter flows are the fully working path right now.

## Troubleshooting

- **Prisma asks to reset the database / mentions drift** — you (or a script) ran `migrate dev` instead of `migrate deploy`. Don't confirm the reset; re-read the callout in step 3.
- **Pet photos look broken** — seeding only points `petPhoto` at URLs in your `pet-images` bucket; it doesn't upload the actual image files. Fine for exercising every flow — upload real files to that bucket yourself if you want photos to render.
- **`/shelters/nearby` returns nothing / errors** — usually means `manual-constraints.sql` wasn't run yet, or the `postgis` extension didn't enable (check **Database → Extensions** in Supabase).
- **Adoption application never appears after "paying"** — the `AdoptionApplication` row is only created by the Stripe webhook after a successful checkout, not by the initial POST (see `CLAUDE.md`). Without Stripe configured, you can exercise everything up to checkout but the row won't be created — this is expected, not a bug.

## Docker Compose alternative

`docker-compose.yml` at the repo root can run a plain local Postgres instead of Supabase for the database. It does **not** include PostGIS or a storage backend, so `/shelters/nearby` and photo/ID uploads won't work against it — for a fully working setup, point `DATABASE_URL` at Supabase as above even if you use Docker for the app containers themselves.
