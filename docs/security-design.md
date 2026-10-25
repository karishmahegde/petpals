# PetPals — Security Design Decisions

PetPals is a public portfolio demo running on free hosting (Vercel + Render + Supabase, with Groq for AI). That shapes the threat model: anyone on the internet can reach it, it must never cost money, and it holds personal-looking data (addresses, government IDs) for six roles. This page records each security decision, why it was made, and its known limits.

---

## 1. Authentication & sessions

| Decision | Why |
| --- | --- |
| **Two-token JWT**: a 15-minute access token kept only in memory (Zustand), plus a 7-day refresh token in an `httpOnly`, `Secure`, `SameSite=Strict` cookie | Script on the page can't read the refresh token (it's `httpOnly`), and a stolen access token expires in 15 minutes. `SameSite=Strict` blocks cross-site request forgery. |
| **Refresh tokens rotate and are stored hashed (SHA-256)**, compared in constant time; one session's token replaces any other's | A database leak doesn't reveal usable tokens, and a replayed old token fails. SHA-256 rather than bcrypt because the token is already long and random. bcrypt made every page load 3–6 s slower on Render's free CPU and added nothing. |
| **Passwords hashed with bcrypt** (10 rounds) | Slow by design, so guessing passwords from a leaked hash is expensive. |
| **One password policy, enforced on the server** (8+ characters, upper, lower, digit, symbol) on register, reset and change; the client mirrors it only for live feedback | The client check is a convenience; the server is the authority (422 lists what's missing). |
| **Account status checked on every request**, not just at login | A Deactivated, Banned or Closed account loses access straight away, even with an unexpired access token. |
| **Changing or resetting a password signs out every other session** | A password change is how people lock out someone who got in. |
| **The live notification stream sends the token in the `Authorization` header** (a streaming `fetch` instead of `EventSource`) and closes when the token expires | Tokens never appear in URLs, so they don't end up in server or proxy logs. |
| **Refresh-cookie traffic is kept first-party:** the browser calls the API through Vercel's `/api` rewrite on the site's own domain | Safari blocks third-party cookies; a same-site cookie can keep `SameSite=Strict`. |

## 2. Authorization

| Decision | Why |
| --- | --- |
| **Role-based access on every endpoint** (`authenticate` + `authorizeRoles(...)`), checked on the server | Hiding a button in the UI is not access control. |
| **Ownership checks in the service layer:** another user's application, donation, appointment or notification answers exactly like a missing one (404) | Doesn't reveal that the record exists. |
| **Shelter scoping:** staff and vets only see and change data at their own shelter | Multi-shelter isolation; the seed includes a second shelter's manager for checking it. |
| **Pending workers get a minimal allow-list** (`authenticate.allowPending`: their own profile, government ID, onboarding, logout, verification, password change) | An unapproved staff member, vet or volunteer can finish onboarding, and nothing more. |
| **Approval requires a verified government ID and finished onboarding** (409 otherwise) | Nobody joins a shelter team unvetted. |
| **Login redirects only follow paths on this site** | Blocks open-redirect phishing (`/login?redirect=https://evil…`). |

## 3. Emailed links & account recovery

| Decision | Why |
| --- | --- |
| **Link tokens are random, stored only as a SHA-256 hash, single-use and short-lived** (reset 1 h; verification, reactivation and email change 24 h); a new link cancels the user's older unused ones | The raw token exists only in the email. A database leak or an old email doesn't grant access. |
| **"Forgot password" and "reactivate" always answer the same 200** | Nobody can use them to find out which emails have accounts. |
| **A 60-second resend cooldown per user** | Stops someone flooding a stranger's inbox. |
| **Email change is two-step:** the link goes to the new address and a heads-up goes to the old one | A hijacker can't silently move the account to their own email. |
| **Soft verification gate:** you can log in unverified, but applying to adopt and donating need a verified email | Payments and applications are tied to an address that has been proven. |

## 4. Abuse & cost protection

| Decision | Why |
| --- | --- |
| **Rate limits** (`config/rateLimits.js`): login 10 / 15 min per email; sign-up 10 / hour; email-link requests 5 / 15 min; link redemption 20 / 15 min; AI 30 / hour per user; the whole API 300 / min per visitor. Each answers 429 in the standard error format, with `retryAfterSeconds` | Slows password guessing, sign-up spam, inbox flooding and quota burning. |
| **Login is limited per email, not per IP** | Password guessing is capped even from many addresses, and one person's typos never lock out others on the same network. Trade-off: someone could lock a single account for 15 minutes on purpose. |
| **The visitor's real IP is read from the proxies' headers** (`x-vercel-forwarded-for` through the site, else `cf-connecting-ip` direct), measured on the live deployment | On Render, Express's `req.ip` is an internal load balancer that changes on almost every request. Limits keyed on it never triggered, which was found and fixed by testing the live site. Known limit: someone calling the API directly could forge the Vercel header to dodge the per-IP limits; the limits that matter most (login per email, AI per user) don't depend on it. |
| **App-wide daily AI cap** (`config/aiUsage.js`, 200 provider calls per UTC day across all users) | Many throwaway accounts can't drain the free AI quota between them. Past the cap, matches fall back to rule scores and the summary says "try again tomorrow". |
| **$0 by design:** free plans only, no payment card on any provider | A traffic spike or abuse can't produce a bill. The worst case is a paused service or used-up free quota. |

## 5. AI features

| Decision | Why |
| --- | --- |
| **No free-text input reaches the model.** The matcher sends fixed quiz wording (the server maps option codes to text) and staff-written pet descriptions. The summary sends health records | The AI can't be used as a general chatbot on the project's quota, and users can't write instructions into the prompt. |
| **Prompt-injection guard:** the prompt tells the model that pet descriptions, record notes and transfer reasons are data, never instructions | Staff-written free text can't steer the model. |
| **No personal data is sent:** no adopter details, and no people's names in passport summaries | Privacy; what reaches a third-party provider is kept to a minimum. |
| **Structured output, re-validated:** strict JSON schema; unknown or repeated IDs are dropped, scores clamped to 0–100, text cut to fit the database columns; summary points must cite a real record | A misbehaving model can't write invalid data. |
| **Results are cached** (matches until the quiz, profile or pets change; summaries by a hash of their input) | Most requests never call the provider. That's faster, and it limits cost and exposure. |
| **Graceful fallback:** any AI failure gives rule-only matches, or a 503 for the summary that is never cached | The site works fully with AI switched off or failing. |
| **Medical judgement stays rule-based:** overdue vaccines come from the rules, and the model is told not to judge due dates | The AI summarises. It never decides anything clinical. |

## 6. Data protection

| Decision | Why |
| --- | --- |
| **Sensitive fields never leave the server:** passwords, refresh tokens, Stripe IDs | Enforced in each response shape. |
| **Government IDs:** files go in a **private** storage bucket and are shown only through 5-minute signed URLs; the ID number is masked (`*****4567`) on every response | Even approvers never get a permanent link or the full number. |
| **Uploads are checked on the server:** 5 MB maximum, one file, JPEG/PNG/WebP/HEIC/PDF only | No arbitrary file types. |
| **Supabase service-role key on the server only** | The client never holds a key that can bypass storage rules. |
| **Deleting an account removes the person and their ID file, but keeps shelter history** (appointments, donations and records are kept with the person's link set to null) | Respects deletion without corrupting other people's records. |
| **Prisma for every query; raw SQL only for PostGIS, through tagged templates** | Parameterised queries block SQL injection. |
| **Strict validation of fixed-value inputs** (400 on a bad enum or filter) | Unexpected input is rejected at the edge. |

## 7. Payments

| Decision | Why |
| --- | --- |
| **Stripe Checkout** (hosted page) for application fees and donations | Card details never touch PetPals' servers. |
| **The webhook verifies Stripe's signature** on the raw body, and records are created only after a verified `checkout.session.completed` | A forged "paid" event is rejected. The client's success page never creates a record. |
| **Idempotent:** the Checkout session ID is UNIQUE, so a replayed webhook can't record twice | Retries are safe. |
| **Production has its own webhook secret**, separate from the local `stripe listen` one | Caught in testing: the local secret had been pasted into Render. |

## 8. Infrastructure

| Decision | Why |
| --- | --- |
| **`helmet`** security headers; Swagger UI served without inline scripts so the content-security policy holds | Standard browser-side hardening. |
| **CORS allows only configured origins** (`CORS_ORIGINS`, else `CLIENT_URL`), with credentials | Other sites can't call the API with a user's cookie. |
| **`trust proxy` set for the hosting proxy** | Correct HTTPS detection, so `Secure` cookies work behind Render. |
| **Secrets only in environment variables:** `.env` is ignored by git and kept out of both Docker images by `.dockerignore`; Render generates `JWT_SECRET`; the server's production dependencies show no `npm audit` advisories | No secrets in the repository or images. |
| **Supabase via the Session pooler** (IPv4) | The direct host is IPv6-only, which Render can't reach. Session mode keeps migrations working. |

## 9. The public demo itself

| Decision | Why |
| --- | --- |
| **Worker demo passwords made private:** the seeded Admin, Staff and Vet passwords (public in the repo) were rotated on the live database by a one-off script that was never committed; every session for those accounts was signed out | Anyone reading the repo could otherwise log in as Admin on the live site. Adopter, Volunteer and Donor stay public demo logins. |
| **"Portfolio demo" notices** on sign-up and on every government-ID upload | Asks visitors for made-up details and sample documents, never real ones. |
| **Seeded emails are fake `@petpals.com` addresses** | Real email is never sent to strangers. |

---

## Known limits (accepted for a demo)

- **One server instance, so counters live in memory.** Rate limits and the daily AI cap reset on a restart (a deploy, or waking after 15 idle minutes). Scaling out would mean a shared store, such as Redis.
- **Per-IP limits on direct API calls can be dodged** with a forged `x-vercel-forwarded-for` header (see §4).
- **The production and development databases are the same Supabase project.** Test runs briefly show test data on the live site.
- **Locking an account through login attempts:** 10 wrong passwords lock that email out for 15 minutes.
