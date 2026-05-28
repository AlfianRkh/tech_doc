const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL ?
    {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // wajib untuk Supabase
    } :
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'techflow',
      user: process.env.DB_USER || 'techflow',
      password: process.env.DB_PASSWORD || 'techflow123',
    }
);

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

module.exports = pool;