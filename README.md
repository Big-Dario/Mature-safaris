# Mother Nature Safaris — Website

The site is split into separate files, with a real Postgres-backed API
for the booking form.

## Project structure

```
mother-nature-safaris/
├── server.js              ← Node/Express server (serves the site + booking API)
├── db.js                  ← PostgreSQL connection + queries
├── package.json           ← dependencies (Express, pg, Helmet, etc.)
├── .env.example           ← copy to .env and fill in your own values
└── public/
    ├── index.html          ← page structure/markup only
    ├── css/
    │   └── styles.css      ← all styling
    ├── js/
    │   └── script.js        ← all front-end behavior (rendering, form, modals)
    └── images/
        ├── README.txt       ← exact filenames to use for your own photos
        └── (your photos go here)
```

## Running it

### Option A — Just open it (no backend)
Double-click `public/index.html` to open it directly in a browser.
Everything works — browsing, packages, gallery, the booking form — except
the booking form will just confirm locally (no database to save it to).

### Option B — Run the real server + database (recommended)

**1. Get a Postgres database.** Pick whichever is easiest for you:

- **Local Postgres via Docker** (fastest way to try this out):
  ```
  docker run --name mns-db -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=mother_nature_safaris -p 5432:5432 -d postgres:16
  ```
- **Local Postgres install** — create a database called
  `mother_nature_safaris` with whatever tool you normally use (psql,
  Postgres.app, pgAdmin, etc).
- **Managed/hosted Postgres** (recommended once you're ready to deploy) —
  Render, Railway, Neon, and Supabase all offer a free Postgres instance.
  Create one and copy the connection string they give you.

**2. Configure the app.**
```
cp .env.example .env
```
Open `.env` and set `DATABASE_URL` to your connection string (the example
file already has the right format for local Docker/Postgres).

**3. Install and run.**
```
npm install
npm start
```
The `bookings` table is created automatically on first run — no manual
migration step needed. Open **http://localhost:3000**.

Now, when someone submits the booking form, it's saved as a real row in
the `bookings` table.

## Viewing booking data

While running locally, **http://localhost:3000/api/bookings** shows all
bookings as JSON (localhost-only by default — see Security below for
deployed use).

To query the database directly:
```
psql $DATABASE_URL
SELECT reference, first_name, last_name, email, destination_label, received_at
FROM bookings
ORDER BY received_at DESC;
```

## Security

This starter includes some baseline protections, but read this before
putting it on the public internet:

- **Bookings list is locked down.** `/api/bookings` only works from
  localhost unless you set an `ADMIN_API_KEY` in `.env` — then pass it as
  an `X-Admin-Key` header to view bookings once deployed.
- **Rate limiting** is on for the booking form (5 submissions per device
  per 10 minutes) and for the site overall, to blunt spam and basic DoS
  attempts.
- **Security headers** are set via Helmet (clickjacking/MIME-sniffing
  protections, a Content-Security-Policy, etc).
- **SQL injection protection** — all database queries use parameterized
  statements (`$1, $2, ...`), never raw string concatenation.
- **Input is validated and length-capped** server-side, and user-typed
  text is HTML-escaped before being shown back in the browser.
- **SSL to the database** is enabled automatically when talking to a
  recognized hosted provider (Render/Railway/Heroku/Neon/Supabase) or when
  `NODE_ENV=production`; see `DB_SSL` in `.env.example` to override.
- **`.env` is gitignored** so secrets never end up in version control.
- **Not yet included, worth adding before handling real customers at
  scale:**
  - HTTPS for the app itself — get this from your hosting provider
    (Render/Railway/Vercel provide it automatically; a VPS needs
    Caddy/Nginx + Let's Encrypt).
  - Database backups (most managed Postgres providers offer automatic
    daily backups — turn this on).
  - A proper migration tool (e.g. `node-pg-migrate` or Prisma Migrate) if
    the schema starts changing often — right now `db.js` just runs an
    idempotent `CREATE TABLE IF NOT EXISTS` on startup, which is fine for
    a schema this simple.
  - Automatic dependency updates / `npm audit` in CI.
  - An email notification or a proper admin dashboard instead of reading
    raw JSON from `/api/bookings`.

## Adding your own photos

See `public/images/README.txt` for the exact filenames to use
(e.g. `kenya.jpg`, `maasai-mara-classic.jpg`, `gallery-lions.jpg`, etc).
Just drop matching files into `public/images/` — no code changes needed.
Anything you haven't added yet will keep showing its emoji placeholder.

## Deploying

- **Static hosting** (GitHub Pages, Netlify, etc.): upload just the
  `public/` folder contents. The booking form will still work in local
  "offline" mode (it confirms the enquiry but can't save it anywhere).
- **Full hosting with a working database-backed booking form** (Render,
  Railway, a VPS, etc.):
  1. Create a managed Postgres instance on the same platform (most offer
     one alongside web hosting).
  2. Set `DATABASE_URL` (and `ADMIN_API_KEY`, `NODE_ENV=production`) as
     environment variables in your hosting dashboard — not in a committed
     `.env` file.
  3. Deploy the whole project; the platform runs `npm install && npm start`
     for you. The `bookings` table is created automatically on first boot.
