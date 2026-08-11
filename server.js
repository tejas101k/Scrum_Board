require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not defined in the environment.');
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  console.error('Error: SESSION_SECRET is not defined in the environment.');
  process.exit(1);
}

// DB connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const app = express();
app.use(express.json());

// Session config
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Static files
app.use(express.static(__dirname));

// Auth state
app.get('/auth/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: 'Not authenticated.' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter both email and password.' });
  }

  try {
    // Lookup user
    const userResult = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email.trim().toLowerCase()]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userResult.rows[0];

    // Verify password hash
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Save session
    req.session.user = {
      id: user.id,
      name: user.name,
      initials: user.initials
    };

    res.json(req.session.user);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Logout
app.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Start server
async function startServer() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`Database connected: ${res.rows[0].now}`);
  } catch (err) {
    console.error('Database connection failed on startup:', err.message);
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
