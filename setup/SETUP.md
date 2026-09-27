# Setup Guide

Gets you from `git clone` to a running PetPals instance with sample data covering every case the app handles — 31 test logins (every account status for every role), 4 shelters, and 21 pets. ~15 minutes, most of it waiting on installs.

For architecture, folder structure, and API reference, see [`CLAUDE.md`](../CLAUDE.md). This file only covers first-time setup. Everything setup-related lives in this `setup/` folder:

| File | What it is |
| --- | --- |
| `SETUP.md` | this guide |
| `setup-storage.js` | creates the Supabase Storage buckets and uploads the seed pet photos. Run by `npm run setup`, so you never call it directly |
| `pet-images/` | the 21 seed pet photos, one per seeded pet (`apollo.webp`, …) |
| `placeholder.jpg` | the photo a pet created through the app shows until staff upload a real one |
| `government-ids/` | 4 sample ID documents (clearly marked SAMPLE) that the seeded ID-verification records point at |

The sample-data seed itself lives with the schema, in `server/src/prisma/seed.js`, because it changes whenever the schema does.

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

### Build the database, storage and sample data

```bash
npm run setup
```

One command, four steps:

1. **`prisma migrate deploy`** builds the entire schema, including the parts `schema.prisma` can't describe: PostGIS and the shelter-location column, the human-readable reference codes (`PE000002`, `APP-00048`, `APT-00123`, …) as Postgres generated columns, and the partial unique indexes. They're written directly into the baseline migration's SQL.
2. **`prisma generate`** builds the Prisma client from the schema.
3. **`setup-storage.js`** creates the two Supabase Storage buckets if they're missing (`pet-images`, public; `government-ids`, private), uploads `setup/pet-images/` to `pet-images/seed/`, uploads `placeholder.jpg` to the bucket root, and uploads `setup/government-ids/` to `government-ids/seed/`. Buckets live in Supabase's own `storage` schema, not the app's, which is why this is a script and not a migration.
4. **`prisma db seed`** loads the sample data.

> ⚠️ **`npm run setup` is for first-time setup — its last step wipes the database.** The seed empties every table and restarts IDs at 1, so every run produces exactly the same data (it refuses to run with `NODE_ENV=production`). Once you're set up, use the individual commands instead:
>
> - re-seed: `npx prisma db seed`
> - new migrations after a pull: `npx prisma migrate deploy && npx prisma generate`
> - re-upload the seed photos, placeholder and sample IDs: `npm run setup:storage` (only ever writes `pet-images/seed/`, `pet-images/placeholder.jpg` and `government-ids/seed/` — app uploads are left alone)

> ⚠️ **Use `migrate deploy`, never `migrate dev`.** (`npm run prisma:migrate` runs `migrate deploy`, so it's safe.) Prisma can't model the PostGIS/generated columns, so `migrate dev` sees them as drift and offers to reset your database. `migrate deploy` just applies the tracked migrations and never prompts. Full explanation in `CLAUDE.md` → Permanent Known Issues.

The seed creates 4 shelters (one per status), 21 pets (one per adoption status), and 31 logins covering every account status for every role, plus applications, visits, appointments, transfers, tasks, events, donations and ID verifications in every status. The command prints every login and what case it represents when it finishes — the main ones are in the [Test accounts](#test-accounts) table below.

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

One fully-featured login per role:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@petpals.com` | `Admin@123` |
| Shelter Staff | `staff@petpals.com` | `Staff@123` |
| Veterinarian | `vet@petpals.com` | `Vet@123` |
| Adopter | `adopter@petpals.com` | `Adopter@123` |
| Volunteer | `volunteer@petpals.com` | `Volunteer@123` |
| Donor | `donor@petpals.com` | `Donor@123` |

Every other seeded account uses its role's password above. The ones worth knowing:

| Email | Case |
| --- | --- |
| `brooklyn.staff@petpals.com` | Manager of the *other* shelter — check cross-shelter isolation |
| `staff.senior@` / `staff.associate@petpals.com` | Non-manager staff at Downtown |
| `staff.unassigned@petpals.com` | Active staff with no shelter |
| `adopter.two@petpals.com` | Adopted Shadow, fostering Hazel, ID pending, competing application on Apollo |
| `adopter.onboarding@petpals.com` | Onboarding stopped at step 4 |
| `vet.brooklyn@` / `volunteer.two@` / `volunteer.brooklyn@petpals.com` | Active at Downtown or Brooklyn |
| `*.pending@petpals.com` (admin, staff, vet, volunteer) | Awaiting approval — can't log in |
| `staff.manager.pending@petpals.com` | Pending Manager sign-up at Queens — an Admin approves |
| `*.deactivated@` / `*.banned@petpals.com` | Closed or banned accounts — login is refused |

## Troubleshooting

- **Prisma asks to reset the database / mentions drift** — you (or a script) ran `migrate dev` instead of `migrate deploy`. Don't confirm the reset; re-read the callout in step 3.
- **`npm run setup` stops at the storage step** — check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `server/.env` (the service-role key, not the anon key). If it says a bucket "exists but is public/private", someone changed it by hand: fix it in **Supabase → Storage → bucket settings** (`government-ids` must be private) and re-run `npm run setup:storage`.
- **Pet photos or ID documents look broken** — the seed files weren't uploaded, or were deleted through the app. Run `npm run setup:storage` from `server/`; it doesn't touch the database.
- **`/shelters/nearby` returns nothing / errors** — usually means the `postgis` extension didn't enable during `migrate deploy` (check **Database → Extensions** in Supabase, then re-run `npx prisma migrate deploy`).
- **Adoption application never appears after "paying"** — the `AdoptionApplication` row is only created by the Stripe webhook after a successful checkout, not by the initial POST (see `CLAUDE.md`). Without Stripe configured, you can exercise everything up to checkout but the row won't be created — this is expected, not a bug.

## Docker Compose alternative

`docker-compose.yml` at the repo root runs the API and client in containers instead of steps 4–5. They use the same Supabase project as everything above — the API container reads `server/.env`, so the database and file storage stay on Supabase.

After steps 1–3 (clone, Supabase project, `server/.env` + `npm run setup`), from the repo root:

```bash
docker-compose up --build
```

The client runs at `http://localhost:3000` and the API at `http://localhost:5000`, the same as the non-Docker setup. `npm run setup` still runs from your machine, once — it isn't part of the containers.
