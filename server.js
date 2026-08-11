// Load environment variables
require('dotenv').config();

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not defined in the environment.');
  process.exit(1);
}

// Create PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  } else {
    console.log(`Database connected: ${res.rows[0].now}`);
    // Clean up and exit since there is no existing server to run
    pool.end();
  }
});
