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
      initials: user.initials,
      email: user.email
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

// Auth check
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Get all users
app.get('/users', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, initials, email FROM users ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all tasks with assignee info
app.get('/tasks', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, u.name AS assignee_name, u.initials AS assignee_initials
      FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id ORDER BY t.id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get one task
app.get('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, u.name AS assignee_name, u.initials AS assignee_initials
      FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create task
app.post('/tasks', requireAuth, async (req, res) => {
  const { title, description, type, priority, status, assignee_id, story_points } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, description, type, priority, status, assignee_id, story_points)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [title, description || '', type || 'task', priority || 'Medium', status || 'todo', assignee_id || null, story_points || 0]
    );
    const { rows } = await pool.query(`
      SELECT t.*, u.name AS assignee_name, u.initials AS assignee_initials
      FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.id = $1
    `, [result.rows[0].id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update task
app.put('/tasks/:id', requireAuth, async (req, res) => {
  const { title, description, type, priority, status, assignee_id, story_points } = req.body;
  try {
    const fields = [];
    const values = [];
    let i = 1;

    if (title !== undefined) { fields.push(`title = $${i++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${i++}`); values.push(description); }
    if (type !== undefined) { fields.push(`type = $${i++}`); values.push(type); }
    if (priority !== undefined) { fields.push(`priority = $${i++}`); values.push(priority); }
    if (status !== undefined) { fields.push(`status = $${i++}`); values.push(status); }
    if (assignee_id !== undefined) { fields.push(`assignee_id = $${i++}`); values.push(assignee_id ? parseInt(assignee_id) : null); }
    if (story_points !== undefined) { fields.push(`story_points = $${i++}`); values.push(story_points ? parseInt(story_points) : 0); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields' });

    values.push(req.params.id);
    const { rowCount } = await pool.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i}`, values);
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });

    const { rows } = await pool.query(`
      SELECT t.*, u.name AS assignee_name, u.initials AS assignee_initials
      FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.id = $1
    `, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete task
app.delete('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Start app
async function startServer() {
  try {
    await pool.query('SELECT NOW()');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL DEFAULT 'task',
        priority VARCHAR(50) NOT NULL DEFAULT 'Medium',
        status VARCHAR(50) NOT NULL DEFAULT 'todo',
        assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        story_points INTEGER DEFAULT 0
      )
    `);
  } catch (err) {
    console.error('DB failed:', err.message);
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
