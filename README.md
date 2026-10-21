# Mother Nature Safaris

Node/Express site with a PostgreSQL booking backend.

## Structure
- `server.js`, `db.js` – backend
- `build-package-pages.js` – generates SEO pages into `public/packages/` and `public/sitemap.xml`
- `public/` – the website (`index.html`, `script.js`, `styles.css`, `robots.txt`). Put photos in `public/Images/` (capital I, exact filenames) including `logo.png`
- `.gitignore` must be named exactly that (with the dot) so `.env` and `node_modules/` are never committed

## Run locally
1. `yarn install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `ADMIN_API_KEY`
3. `yarn build` then `yarn start` → http://localhost:3000

## Deploy on Render
1. Create a **PostgreSQL** database on Render first.
2. Create a **Web Service** from the repo:
   - Build Command: `yarn install && yarn build`
   - Start Command: `yarn start`
3. Environment tab: `DATABASE_URL` = the database's **Internal Database URL** (same region as the web service), `ADMIN_API_KEY` = a long random string, `NODE_VERSION=18`
4. After deploy, open `https://YOUR-APP.onrender.com/api/health` — it must show `{"ok":true,"database":"connected"}`. If not, the message says what is missing.
5. Add the custom domain under Settings → Custom Domains, then submit `/sitemap.xml` in Google Search Console.

## GitHub Pages
GitHub Pages is static hosting and cannot run `server.js`, so the booking form cannot work there by itself. Either use the Render URL as the live site, or set `RENDER_API_URL` at the top of `public/script.js` to your Render URL (the server already allows `https://big-dario.github.io` via CORS).

## Admin
`GET /api/bookings` with header `X-Admin-Key: <ADMIN_API_KEY>`
