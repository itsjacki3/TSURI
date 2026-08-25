# Tsuri Gardens — Hotel Manager (React + Vite + Supabase)

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

