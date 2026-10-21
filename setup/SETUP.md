# Setup Guide

Gets you from `git clone` to a running PetPals instance with sample data covering every case the app handles — 50 test logins (every account status for every role), 4 shelters, and 21 pets. ~15 minutes, most of it waiting on installs.

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
3. **Connect** (top bar) → **Direct** → set the method to **Session pooler** → copy the URI (host `aws-…pooler.supabase.com`, port **5432**, user `postgres.<project-ref>`), with your DB password filled in. The direct-connection host is IPv6-only, which Docker containers and Render can't reach; the session pooler is IPv4 and keeps a real session, so Prisma's migrations work through it. Not the **transaction** pooler (port 6543) — migrations need session mode.

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
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | *optional* — leave blank to run without AI; see [AI features (optional)](#ai-features-optional) |

`PORT`, `NODE_ENV`, and `JWT_EXPIRES_IN` can stay at their defaults. The client has its own env file, configured in step 5. To switch on the AI features, follow [AI features (optional)](#ai-features-optional) once you're set up.

### Build the database, storage and sample data

```bash
npm run setup
```

One command, four steps:

1. **`prisma migrate deploy`** builds the entire schema, including the parts `schema.prisma` can't describe: PostGIS and the shelter-location column, the human-readable reference codes (`PE000002`, `APP-00048`, `APT-00123`, …) as Postgres generated columns, and the partial and expression unique indexes. They're written directly into the baseline migration's SQL.
2. **`prisma generate`** builds the Prisma client from the schema.
3. **`setup-storage.js`** creates the two Supabase Storage buckets if they're missing (`pet-images`, public; `government-ids`, private), uploads `setup/pet-images/` to `pet-images/seed/`, uploads `placeholder.jpg` to the bucket root, and uploads `setup/government-ids/` to `government-ids/seed/`. Buckets live in Supabase's own `storage` schema, not the app's, which is why this is a script and not a migration.
4. **`prisma db seed`** loads the sample data.

> ⚠️ **`npm run setup` is for first-time setup — its last step wipes the database.** The seed empties every table and restarts IDs at 1, so every run produces exactly the same data (it refuses to run with `NODE_ENV=production`). Once you're set up, use the individual commands instead:
>
> - re-seed: `npx prisma db seed`
> - new migrations after a pull: `npx prisma migrate deploy && npx prisma generate`
> - re-upload the seed photos, placeholder and sample IDs: `npm run setup:storage` (only ever writes `pet-images/seed/`, `pet-images/placeholder.jpg` and `government-ids/seed/` — app uploads are left alone)

> ⚠️ **Use `migrate deploy`, never `migrate dev`.** (`npm run prisma:migrate` runs `migrate deploy`, so it's safe.) Prisma can't model the PostGIS/generated columns, so `migrate dev` sees them as drift and offers to reset your database. `migrate deploy` just applies the tracked migrations and never prompts. Full explanation in `CLAUDE.md` → Permanent Known Issues.

The seed creates 4 shelters (one per status), 21 pets (one per adoption status), and 50 logins covering every account status for every role, plus applications, visits, appointments, transfers, tasks, events, donations and ID verifications in every status. The command prints every login and what case it represents when it finishes — the main ones are in the [Test accounts](#test-accounts) table below.

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
echo "VITE_API_URL=http://localhost:5000/api/v1" > .env.local
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
| `*.pending@petpals.com` (admin, vet, volunteer) | Awaiting approval — can't log in |
| `staff.pending@petpals.com` | Pending, onboarding done, ID awaiting verification — logs in to the "awaiting approval" screen; Downtown's manager verifies the ID, then approves |
| `staff.onboarding@petpals.com` | Pending, stopped mid-onboarding (step 3) — logs in straight to the onboarding wizard |
| `staff.manager.pending@petpals.com` | Pending Manager sign-up at Queens, onboarding done, ID awaiting verification — an Admin verifies and approves |
| `*.closed@petpals.com` (every role) | Closed by its owner — login is refused; the owner can reopen it with an emailed reactivation link |
| `*.deactivated@` / `*.declined@` / `*.banned@petpals.com` | Deactivated by an admin/staff member, declined at approval, or banned — login is refused |
| `adopter.unverified@` / `donor.unverified@petpals.com` | Email not verified — verify banner shown; applying to adopt / donating is blocked until verified |

## AI features (optional)

Two features use AI. Everything else in the app works the same with or without it.

| Feature | What the AI adds |
| --- | --- |
| Adopter compatibility matcher | a personality-fit score for each shortlisted pet (blended with the rule-based score) and a one-line "why this match" reason on each card |
| Health passport → **Summarize with AI** (Staff, Vet, Admin) | a short summary of the pet's records, doses and transfers, plus "Points to review" that each link to the record they came from |

The server talks to any OpenAI-compatible provider through one file, `server/src/services/ai/openAiCompatible.js`. AI switches on only when **all three** of `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL` are set in `server/.env`. If any of them is blank, the app runs without AI.

### Option A: Groq (free tier, recommended)

1. Sign up at [console.groq.com](https://console.groq.com). Groq rejects Outlook email sign-ups, so use Google or another email provider.
2. Create a key at [console.groq.com/keys](https://console.groq.com/keys).
3. In `server/.env`:

   ```bash
   AI_BASE_URL=https://api.groq.com/openai/v1
   AI_API_KEY=<your key>
   AI_MODEL=openai/gpt-oss-20b
   ```

4. Restart the server (`npm run dev`). The config is read on every AI call, but `.env` itself is only loaded once at startup.

**Free-tier limits.** Groq's free tier caps requests and tokens per minute and per day for each model. The exact numbers change, so check [Groq's rate-limits page](https://console.groq.com/docs/rate-limits) instead of relying on figures here. The app is built to stay well inside them:

- **One AI call per recompute.** The matcher scores every available pet with rules first, then sends only the top 20 (the shortlist) to the AI in a single call, with low reasoning effort and a 2000-token reply cap (`AI_MATCH_CALL` in `server/src/config/matchScoring.js`). The passport summary is also one call per generation, with low effort and a 1500-token cap (`AI_SUMMARY_CALL` in `server/src/config/passportSummary.js`).
- **Results are cached.** Matches are stored in `AdopterMatch` and summaries in `PetHealthSummary`, so ordinary page loads read the cache and don't call the AI again.
- **Recomputes happen only when something changed.** Matches are recomputed after the adopter retakes the quiz or edits a profile field the matcher reads, or after a pet changes (a new or edited available pet, or a cached pet that was adopted or edited). A summary is regenerated only when the pet's passport changes (a new or edited record, dose or transfer).
- **A 429 (rate limited) is a fallback, not a crash.** It's handled like any other provider failure. See [Without AI, or when the provider fails](#without-ai-or-when-the-provider-fails) below.

### Option B: Ollama (local, no account)

1. Install [Ollama](https://ollama.com) and pull the model:

   ```bash
   ollama pull gpt-oss:20b
   ```

2. In `server/.env`:

   ```bash
   AI_BASE_URL=http://localhost:11434/v1
   AI_API_KEY=ollama
   AI_MODEL=gpt-oss:20b
   ```

   Ollama ignores the key, but it still has to be non-empty, or the app treats AI as switched off.

3. Restart the server.

No account or rate limits, but it's much slower than Groq and needs a capable machine to run a 20B model.

### Without AI, or when the provider fails

| Situation | Matcher | Summarize with AI |
| --- | --- | --- |
| **No AI configured** (any of the three blank) | works on the rule-based scores only; cards show no AI reason | the button is disabled on the passport (`aiSummaryAvailable` is `false`) |
| **AI configured, provider fails** (rate limited, timeout, bad key, invalid reply) | falls back to the rule-based scores for that recompute, and logs a warning | returns a retryable `503` ("try again shortly"); nothing is cached, so the next try calls the AI again |

Nothing crashes in either case. A bad or revoked key is logged as an error in the server terminal (other failures as warnings), so check there if AI results stop appearing.

**Tests never call the AI.** `server/src/tests/setup/noAiProvider.js` runs before every test file and blanks the `AI_*` variables, so a real key in `server/.env` is never used. Suites that test AI behaviour mock it instead.


## Email (optional)

The app sends email for these:

| Email | When |
| --- | --- |
| Verify your email address | at sign-up, and from **Resend** (dashboard banner, Profile, the apply/donate notice) |
| Reset your password | **Forgot password?** on either login page |
| Reactivate your account | logging in to an account you closed → **Email me a reactivation link** |
| Confirm your new email address | Profile → **Account & security** → Change email (plus a heads-up to the old address) |
| Account notices | your account closed or deleted; approved, declined, deactivated, banned or restored by someone else; your password or email changed |
| Review outcomes | your government ID verified or rejected; your adoption application approved or declined |

Applying to adopt and donating need a verified email address. Everything else works unverified.

### Without email (default)

Leave `EMAIL_API_KEY` and `EMAIL_FROM` blank in `server/.env`. Nothing is sent. Every email is printed to the server terminal instead, with its link, so you can copy the link into the browser and use any flow locally:

```text
[email] not configured — would send to jane@example.com
Subject: Verify your PetPals email address
...
```

### With Brevo (real email)

Email goes through [Brevo](https://www.brevo.com)'s HTTPS API, not SMTP — hosting platforms often block outbound SMTP, especially on free plans. Brevo's free plan allows 300 emails a day.

1. Sign up at [brevo.com](https://www.brevo.com) and complete the account profile it asks for.
2. **Verify a sender.** Go to **Senders, Domains & Dedicated IPs → Senders → Add a sender**, enter `PetPals` as the name and an address you can receive mail at, then confirm the code Brevo emails to it. Recipients see this address, so use a dedicated one rather than a personal address once other people use the app.
3. **Create an API key.** Go to **SMTP & API → API Keys → Generate a new API key**. Copy it straight away, because Brevo shows it only once. It starts with `xkeysib-`. The SMTP key (`xsmtpsib-…`) won't work.
4. **Authorised IPs.** Newer accounts block API calls from IP addresses Brevo doesn't recognise. Under **Security → Authorised IPs**, add your IP, or turn the blocking off. Turn it off for Render, whose outgoing IPs change.
5. In `server/.env`:

   ```bash
   EMAIL_API_KEY=<your key>
   EMAIL_FROM=<the sender address you verified>
   EMAIL_FROM_NAME=PetPals
   ```

   Email switches on only when **both** `EMAIL_API_KEY` and `EMAIL_FROM` are set.
6. Restart the server (`npm run dev`).
7. Register an account with your own email address and check that the verification email arrives.

**Check your spam folder.** Mail sent "from" a Gmail or Outlook address through Brevo often lands there, because those providers don't recognise Brevo as an allowed sender for their addresses. For a deployment, verify your own domain under Brevo's **Domains** tab and send from an address on it.

**Don't use the seeded logins with real email on.** Their `@petpals.com` addresses don't exist, so approving, declining or resetting them sends mail that bounces, which counts against your Brevo sender reputation.

**If an email doesn't arrive,** the server terminal logs a line starting with `[email] failed to send` with Brevo's reason, and Brevo's **Transactional → Logs** page shows what it received. A failed email never fails the request that triggered it.

**Tests never send email.** `server/src/tests/setup/noEmailProvider.js` runs before every test file and blanks the `EMAIL_*` variables, so a real key in `server/.env` is never used. Suites that test email mock it instead.

<a id="running-the-tests"></a>

## Running the tests

Nothing extra to install — `npm install` in `server/` and `client/` brings Jest, Vitest and Cypress.

| Run | From | Needs |
| --- | --- | --- |
| `npm run test:unit` | `server/` | Nothing beyond `npm install` + `npx prisma generate` (done by `npm run setup`) — everything external is mocked, no database. Fails below 80% lines / 70% branches. |
| `npm run test:integration` | `server/` | `server/.env` from step 3. Runs against that database, creating its own test data (logins end in `@ex.com`) and removing it afterwards. The Stripe-webhook journeys need `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (test mode). Slow over a remote database — several minutes. |
| `npm run test:leftovers` | `server/` | Read-only: lists any test data a crashed run left behind. Nothing is deleted. |
| `npm test` · `npm run typecheck` · `npm run lint` | `client/` | Nothing — no servers, no database. |
| `npm run cypress:open` / `cypress:run` | `client/` | Both dev servers running (steps 4 and 5) and the Stripe test keys in `server/.env` (the apply spec creates a real test-mode Checkout Session; Stripe's page itself is never loaded). Specs create and remove their own data in the same database. |

Tests never call the AI provider or send email, whatever is in `server/.env` (see the notes under AI features and Email).

## Troubleshooting

- **Prisma asks to reset the database / mentions drift** — you (or a script) ran `migrate dev` instead of `migrate deploy`. Don't confirm the reset; re-read the callout in step 3.
- **`npm run setup` stops at the storage step** — check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `server/.env` (the service-role key, not the anon key). If it says a bucket "exists but is public/private", someone changed it by hand: fix it in **Supabase → Storage → bucket settings** (`government-ids` must be private) and re-run `npm run setup:storage`.
- **Pet photos or ID documents look broken** — the seed files weren't uploaded, or were deleted through the app. Run `npm run setup:storage` from `server/`; it doesn't touch the database.
- **`/shelters/nearby` returns nothing / errors** — usually means the `postgis` extension didn't enable during `migrate deploy` (check **Database → Extensions** in Supabase, then re-run `npx prisma migrate deploy`).
- **A test run left data behind** (`npm run test:leftovers` lists rows) — usually a run stopped part-way (Ctrl-C, or the database link dropped). Rerunning the suite doesn't remove another run's rows; delete the listed ones (they're all test data, but check before removing species or vaccines someone may have added by hand).
- **A Cypress spec lands on the onboarding wizard or "no entry" page** — the spec's user hasn't finished onboarding (use `db:completeOnboarding`), or a `cy.request` login left another user's refresh cookie behind (`cy.clearAllCookies()` before `cy.visit`).
- **Adoption application never appears after "paying"** — the `AdoptionApplication` row is only created by the Stripe webhook after a successful checkout, not by the initial POST (see `CLAUDE.md`). Without Stripe configured, you can exercise everything up to checkout but the row won't be created — this is expected, not a bug.

## Docker Compose alternative

`docker-compose.yml` at the repo root runs the API and client in containers instead of steps 4–5. They use the same Supabase project as everything above — the API container reads `server/.env`, so the database and file storage stay on Supabase.

After steps 1–3 (clone, Supabase project, `server/.env` + `npm run setup`), from the repo root:

```bash
docker-compose up --build
```

The client runs at `http://localhost:3000` and the API at `http://localhost:5000`, the same as the non-Docker setup. `npm run setup` still runs from your machine, once — it isn't part of the containers.
