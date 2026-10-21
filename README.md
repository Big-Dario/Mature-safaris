# Mother Nature Safaris

Node/Express site with a PostgreSQL booking backend.

## Structure
- `server.js`, `db.js` – backend
- `build-package-pages.js` – generates SEO pages into `public/packages/` and `public/sitemap.xml`
- `public/` – the website. Put your photos in `public/Images/` (capital I, exact filenames) including `logo.png`

## Run locally
1. `yarn install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `ADMIN_API_KEY`
3. `yarn build` then `yarn start` → http://localhost:3000

## Deploy on Render
- Build Command: `yarn install && yarn build`
- Start Command: `yarn start`
- Environment: `DATABASE_URL`, `ADMIN_API_KEY`, `NODE_VERSION=18`
- Add the custom domain under Settings → Custom Domains, then submit `/sitemap.xml` in Google Search Console.
- Re-run `yarn build` (Render does this on each deploy) whenever packages change.

## Admin
`GET /api/bookings` with header `X-Admin-Key: <ADMIN_API_KEY>`
