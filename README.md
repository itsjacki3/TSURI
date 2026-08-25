# Tsuri Gardens — Hotel Manager (React + Vite + Supabase)

This is a React/Vite rebuild of the original PHP hotel management dashboard.
Same Supabase Postgres database, same pages, same look — but it now builds
to a set of static files, which is what maKES  it deploy cleanly on Vercel
(or Netlify, Cloudflare Pages, GitHub Pages, etc.) instead of needing a PHP
server.

## What changed, and why

The old app was a PHP server that connected straight to Postgres with a
database username and password (`includes/config.php`) and ran SQL from
server-side code. A Vite/React build ships to the browser as plain
JavaScript — **there is no server left to hold that database password**, so
it can't be carried over as-is. That's very likely why Vercel was giving you
trouble too: Vercel serves this kind of app as static files (or serverless
functions), not as a long-running PHP+PDO process.

Instead, the React app talks to Supabase directly from the browser using
its standard client library (`@supabase/supabase-js`) and the public **anon
key** — the key that's designed to be shipped in a browser bundle. Two
things make that safe:

1. **Row Level Security (RLS)** is turned on for every table. See
   `supabase/02_react_client_migration.sql`. The policies are permissive
   (`USING (true)`) so the app keeps the *same* access level the PHP
   version had — its `require_login()` checks were commented out on every
   page, so every table was already reachable by anyone who could load the
   app. If you want real per-role restrictions (e.g. Housekeeping Supervisor
   can't touch billing), that's the next thing to layer on top, once you
   wire up Supabase Auth or JWT claims for staff roles — the RLS policies
   are the place to tighten.
2. **Staff logins never leave a password hash in the browser.** The
   `staff` table is the one exception to the permissive policies above —
   it holds `password_hash`, so RLS blocks the anon key from reading or
   writing it directly. All staff login/create/edit/delete goes through a
   handful of Postgres functions instead (`staff_login`, `staff_list`,
   `staff_create`, `staff_update`, `staff_delete`), and password hashing —
   using the same bcrypt algorithm PHP's `password_hash()` used — happens
   inside Postgres via the `pgcrypto` extension. The browser only ever
   sends a plaintext password over HTTPS to be checked; it never sees or
   stores a hash.

Everything else — rooms, bookings, guests, invoices, incident reports,
settings — reads and writes straight to the Supabase tables via
`supabase-js`, the same way the PHP pages read and wrote via PDO.

## Project layout

```
hotel-manager-react/
├── supabase/
│   ├── 01_schema_and_seed_data.sql       # your original schema + seed data, unchanged
│   └── 02_react_client_migration.sql     # NEW — RLS policies + login/dashboard functions
├── src/
│   ├── assets/style.css                  # your original stylesheet, unchanged
│   ├── lib/supabaseClient.js             # supabase-js client (reads .env)
│   ├── context/AuthContext.jsx           # staff login/logout, session in localStorage
│   ├── hooks/useSettings.js              # cached reads of the `settings` table
│   ├── components/                       # Sidebar, Topbar, Layout, Modal, ProtectedRoute
│   └── pages/                            # Login, Dashboard, Rooms, Bookings, Guests,
│                                          #   Staff, Billing, Reports, SettingsPage, Search
├── .env.example
└── package.json
```

Each page matches its PHP counterpart 1:1 (`rooms.php` → `pages/Rooms.jsx`,
`bookings.php` → `pages/Bookings.jsx`, etc.), including the stat cards,
table filters, and the Add/Edit modal pattern from `assets/js/modal.js`
(now a small `<Modal>` component driven by React state instead of
`data-record` JSON attributes).

## Setup

### 1. Run the SQL in Supabase

In your Supabase project's SQL Editor:

1. Run `supabase/01_schema_and_seed_data.sql` first — **skip this step if
   you already ran it before** (it's the same file you already had; running
   it twice will error on `CREATE TABLE`).
2. Run `supabase/02_react_client_migration.sql`. This is new — it adds
   RLS policies and the staff/dashboard functions the React app needs. Safe
   to run once your tables from step 1 exist.

### 2. Unlock a staff login

The seeded staff rows ship with placeholder password hashes (they were
never real bcrypt hashes to begin with, just placeholders in the export),
so nobody can sign in until you set a real password. In the SQL Editor:

```sql
UPDATE staff SET password_hash = crypt('choose-a-real-password', gen_salt('bf'))
WHERE email = 'jackie.wanyeki@tsurigardens.com';
```

(You can also do this later from inside the app, via Staff & Roles → Edit,
once you're logged in with at least one account.)

### 3. Configure the app

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **Supabase →
Project Settings → API**. Use the `anon` `public` key — never the
`service_role` key (that one bypasses RLS and must never ship to a
browser).

### 4. Install and run

```bash
npm install
npm run dev
```

Visit the printed local URL and sign in with the email/password you set in
step 2.

### 5. Build for production

```bash
npm run build
```

This outputs a static `dist/` folder — deploy it anywhere that serves
static files (Vercel, Netlify, Cloudflare Pages, GitHub Pages, S3, etc.).
On Vercel specifically: import the repo, and it will auto-detect Vite
(build command `npm run build`, output directory `dist`). Add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Environment Variables
in the Vercel project settings — the same two values from your `.env`.

## Notes / things worth knowing

- **Login is enforced now.** The original PHP pages all had
  `require_login()` calls, but every single one was commented out — so the
  whole app was actually open to anyone with the URL. The React version
  turns login back on (`ProtectedRoute`), which is a small behavior change
  from what you had live, but almost certainly what was intended.
- **Booking references and invoice numbers** (`BK-xxxxx`, `INV-xxxx`) are
  generated the same way the PHP did: insert the row, then use its own new
  `id` to build the final reference and update it — see the `onSubmit`
  handlers in `Bookings.jsx` / `Billing.jsx`.
- **The dashboard's occupancy/ADR/RevPAR numbers and revenue chart** are
  computed by a single Postgres function (`dashboard_stats()`) instead of
  several separate queries, so the page loads in one round trip. It
  reproduces `dashboard.php`'s week/month/year/all-time bucketing exactly.
- **RLS policies are currently permissive** (any signed-in-to-the-app user
  can read/write any table), matching the PHP app's actual behavior. This
  is a reasonable starting point for an internal tool, but if this is going
  in front of the public internet, it's worth tightening — happy to help
  wire up per-role policies (Housekeeping vs. Front Office vs. Admin) using
  the `roles` table you already have.
