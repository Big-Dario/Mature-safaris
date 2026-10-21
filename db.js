// PostgreSQL layer for Mother Nature Safaris bookings.
// Needs DATABASE_URL in .env (e.g. postgres://user:pass@host:5432/dbname)
require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to your .env file (or your host\'s environment variables).');
}

// Managed hosts (Render, Railway, Neon, Supabase) require SSL; local Postgres does not.
// Set DATABASE_SSL=false only if your host's Postgres genuinely has no SSL.
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');
const useSsl = !isLocal && process.env.DATABASE_SSL !== 'false';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000, // fail in 10s instead of hanging the form forever
  idleTimeoutMillis: 30000
});

// Managed hosts (Render etc.) drop idle DB connections. Without this handler
// that 'error' event is unhandled and CRASHES the whole Node process.
pool.on('error', (err) => {
  console.error('Postgres pool error (non-fatal):', err.message);
});

async function initDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      country TEXT,
      travellers TEXT,
      destination TEXT,
      destination_label TEXT,
      duration TEXT,
      arrival_date TEXT,
      departure_date TEXT,
      package TEXT,
      accommodation TEXT,
      notes TEXT,
      estimated_total TEXT,
      newsletter BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function insertBooking(b) {
  const { rows } = await pool.query(
    `INSERT INTO bookings
      (reference, first_name, last_name, email, phone, country, travellers,
       destination, destination_label, duration, arrival_date, departure_date,
       package, accommodation, notes, estimated_total, newsletter)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING reference`,
    [b.reference, b.firstName, b.lastName, b.email, b.phone, b.country, b.travellers,
     b.destination, b.destinationLabel, b.duration, b.arrivalDate, b.departureDate,
     b.package, b.accommodation, b.notes, b.estimatedTotal, b.newsletter]
  );
  return rows[0];
}

async function getAllBookings() {
  const { rows } = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC');
  return rows;
}

module.exports = { initDb, insertBooking, getAllBookings, pool };
