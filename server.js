// ═══════════════════════════════════════════════════════
//  MOTHER NATURE SAFARIS — Server
//  A small Node/Express server that:
//    1. Serves the static site (HTML, CSS, JS, images) from /public
//    2. Provides a backend endpoint for the booking form, backed by
//       PostgreSQL (see db.js):
//         POST /api/bookings   → saves the enquiry to the "bookings" table
//         GET  /api/bookings   → lists saved enquiries (requires admin key)
//
//  SECURITY NOTES (read this before deploying anywhere public):
//    - Set ADMIN_API_KEY in a .env file (see .env.example) before deploying.
//      Without it, the /api/bookings list endpoint is locked to localhost only.
//    - Set DATABASE_URL in .env, pointing at your Postgres instance (local,
//      or a managed one from Render/Railway/etc). See db.js and README.md.
//    - Put this behind HTTPS in production — most hosts (Render, Railway,
//      Vercel, a VPS behind Caddy/Nginx) handle this for you automatically.
// ═══════════════════════════════════════════════════════
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || null;

// ── Security middleware ─────────────────────────────────
// Render (and most hosts) put a proxy in front of the app. Without this,
// every visitor looks like the same IP, which breaks the rate limiters and
// the localhost check in requireAdmin.
app.set('trust proxy', 1);

app.use(compression());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "style-src": ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      // The site uses inline handlers (onerror=, onclick=) — Helmet blocks these by default
      "script-src-attr": ["'unsafe-inline'"],
      "img-src": ["'self'", "data:"],
    },
  },
}));

// ── CORS for the booking API ────────────────────────────
// Same-origin requests (the site served by this server) need no CORS. This is
// only for a copy of the page hosted elsewhere (e.g. GitHub Pages) posting to
// this server. Comma-separated list in ALLOWED_ORIGINS; defaults to the
// GitHub Pages site.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://big-dario.github.io')
  .split(',').map((o) => o.trim()).filter(Boolean);
app.use('/api', (req, res, next) => {
  const origin = req.get('Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Admin-Key');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

// Limit request body size so no one can send a huge payload to exhaust memory/disk
app.use(express.json({ limit: '20kb' }));

// Rate-limit the booking endpoint: max 5 submissions per IP per 10 minutes.
// Stops both accidental double-submits and deliberate spam/DoS attempts.
const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking requests from this device. Please try again later.' }
});

// Separate, looser limiter for the whole app so static assets aren't affected
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// Static files. Images are cached for 30 days (rename a file if you replace it);
// HTML/CSS/JS are cached for 1 hour so updates show up quickly.
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  setHeaders: (res, filePath) => {
    if (/[\\/]Images[\\/]/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    } else if (/\.html$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=300');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// ── API: list image filenames in /public/Images ─────────
// script.js uses this to match data entries to your real filenames
// (replaces the old call to GitHub's API).
let imageListCache = { time: 0, files: [] };
app.get('/api/images', (req, res) => {
  if (Date.now() - imageListCache.time > 60 * 1000) {
    try {
      imageListCache.files = fs.readdirSync(path.join(__dirname, 'public', 'Images'))
        .filter((f) => /\.(jpe?g|png|webp|avif|gif|svg)$/i.test(f));
    } catch (e) {
      imageListCache.files = [];
    }
    imageListCache.time = Date.now();
  }
  res.set('Cache-Control', 'public, max-age=60');
  res.json(imageListCache.files);
});

// ── Helpers ────────────────────────────────────────────
function generateReference() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `MNS-${year}-${random}`;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email) && email.length <= 254;
}

function isValidPhone(phone) {
  return typeof phone === 'string' && /^[0-9+()\-.\s]{6,20}$/.test(phone);
}

// Cap every text field's length so no field can be used to bloat storage
// or smuggle in oversized/garbage data.
const FIELD_LIMITS = {
  firstName: 60, lastName: 60, email: 254, phone: 20, country: 60,
  travellers: 10, destination: 30, destinationLabel: 60, duration: 10,
  arrivalDate: 20, departureDate: 20, package: 40, accommodation: 20,
  notes: 1000, estimatedTotal: 60
};

function sanitizeString(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

// Only allow requests to the admin bookings list from localhost, OR from
// anyone who supplies the correct X-Admin-Key header (set ADMIN_API_KEY
// in your .env to enable this off of localhost, e.g. for a hosted admin view).
function requireAdmin(req, res, next) {
  const key = req.get('X-Admin-Key');
  const isLocalhost = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);

  if (ADMIN_API_KEY && key === ADMIN_API_KEY) return next();
  if (!ADMIN_API_KEY && isLocalhost) return next();

  return res.status(401).json({ error: 'Unauthorized. Set ADMIN_API_KEY and pass it via the X-Admin-Key header.' });
}

// ── Database readiness ─────────────────────────────────
// The site must still load even if the database is down or misconfigured, and
// the booking form must say WHY it failed instead of the whole server dying.
let dbReady = false;
let dbLastError = null;
let dbInitPromise = null;

function ensureDb() {
  if (dbReady) return Promise.resolve();
  if (!dbInitPromise) {
    dbInitPromise = db.initDb()
      .then(() => { dbReady = true; dbLastError = null; console.log('Database connected and schema ready.'); })
      .catch((err) => { dbLastError = err.message; console.error('Database init failed:', err.message); throw err; })
      .finally(() => { dbInitPromise = null; });
  }
  return dbInitPromise;
}

// Quick check you can open in a browser: https://YOUR-APP.onrender.com/api/health
app.get('/api/health', async (req, res) => {
  try { await ensureDb(); res.json({ ok: true, database: 'connected' }); }
  catch (e) { res.status(503).json({ ok: false, database: 'unavailable', hint: process.env.DATABASE_URL ? 'DATABASE_URL is set but the connection failed — check the URL (use Render\'s Internal Database URL) and the app logs.' : 'DATABASE_URL is not set in the Render Environment tab.' }); }
});

// ── API: create a booking enquiry ───────────────────────
app.post('/api/bookings', bookingLimiter, async (req, res, next) => {
  try {
    const b = req.body || {};

    if (!sanitizeString(b.firstName, 1) || !sanitizeString(b.lastName, 1)) {
      return res.status(400).json({ error: 'First and last name are required.' });
    }
    if (!isValidEmail(b.email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!isValidPhone(b.phone)) {
      return res.status(400).json({ error: 'A valid phone number is required.' });
    }
    if (!b.destination || !b.duration || !b.arrivalDate || !b.package) {
      return res.status(400).json({ error: 'Destination, duration, arrival date and package are required.' });
    }

    // Sanitize/clip every field before it ever touches the database
    const clean = {};
    Object.keys(FIELD_LIMITS).forEach((key) => {
      clean[key] = sanitizeString(b[key], FIELD_LIMITS[key]);
    });
    clean.newsletter = !!b.newsletter;
    clean.reference = generateReference();

    try {
      await ensureDb();
    } catch (e) {
      return res.status(503).json({ error: 'Our booking system is temporarily unavailable. Please contact us directly by phone/WhatsApp/email.' });
    }

    const saved = await db.insertBooking(clean);

    console.log(`New booking enquiry received: ${saved.reference}`);
    res.status(201).json({ success: true, reference: saved.reference });
  } catch (err) {
    next(err);
  }
});

// ── API: list bookings (admin-only) ─────────────────────
app.get('/api/bookings', requireAdmin, async (req, res, next) => {
  try {
    await ensureDb();
    const bookings = await db.getAllBookings();
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

// ── Fallback: send index.html for any other route ───────
app.get('*', (req, res) => {
  // A missing file (anything with an extension, e.g. a broken image path)
  // must be a real 404, not the homepage with a 200.
  if (path.extname(req.path)) return res.status(404).send('Not found');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Generic error handler — never leak stack traces to clients ─
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// ── Startup ─────────────────────────────────────────────
// Start listening FIRST so Render sees a healthy service and the site loads,
// then connect to the database. If the DB fails, bookings return a clear 503
// (and retry on the next request) instead of the whole app crashing.
app.listen(PORT, () => {
  console.log(`Mother Nature Safaris server running on port ${PORT}`);
  if (!ADMIN_API_KEY) {
    console.log('ADMIN_API_KEY not set — /api/bookings is only reachable from localhost.');
  }
  ensureDb().catch(() => {
    console.error('Could not reach the database. Check DATABASE_URL in Render → Environment.');
  });
});
