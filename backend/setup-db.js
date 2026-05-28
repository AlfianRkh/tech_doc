/**
 * Run this once to create the schema and seed data.
 * Usage: node setup-db.js
 */
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setup() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'techflow',
    user: process.env.DB_USER || 'techflow',
    password: process.env.DB_PASSWORD || 'techflow123',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    const schema = fs.readFileSync(path.join(__dirname, 'src/db/schema.sql'), 'utf8');
    await client.query(schema);
    console.log('Schema created');

    const seed = fs.readFileSync(path.join(__dirname, 'src/db/seed.sql'), 'utf8');
    await client.query(seed);
    console.log('Seed data inserted');

    console.log('\nDatabase setup complete!');
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setup();
