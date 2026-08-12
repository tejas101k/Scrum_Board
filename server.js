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
  const { title, description, type, priority, status, assignee_id, story_points, sprint_id } = req.body;
  
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
  }
  if (type !== undefined && !['task', 'bug', 'story'].includes(type)) {
    return res.status(400).json({ error: 'Invalid issue type' });
  }
  if (priority !== undefined && !['Low', 'Normal', 'Medium', 'High'].includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority value' });
  }
  if (status !== undefined && !['todo', 'progress', 'review', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
  if (story_points !== undefined) {
    const pts = parseInt(story_points);
    if (isNaN(pts) || pts < 0) {
      return res.status(400).json({ error: 'Story points must be a non-negative number' });
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, description, type, priority, status, assignee_id, story_points, sprint_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [title, description || '', type || 'task', priority || 'Medium', status || 'todo', assignee_id || null, story_points || 0, sprint_id ? parseInt(sprint_id) : null]
    );
    const { rows } = await pool.query(`
      SELECT t.*, u.name AS assignee_name, u.initials AS assignee_initials
      FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.id = $1
    `, [result.rows[0].id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid assignee or sprint reference' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update task
app.put('/tasks/:id', requireAuth, async (req, res) => {
  const { title, description, type, priority, status, assignee_id, story_points, sprint_id } = req.body;

  if (title !== undefined && (!title || typeof title !== 'string' || !title.trim())) {
    return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
  }
  if (type !== undefined && !['task', 'bug', 'story'].includes(type)) {
    return res.status(400).json({ error: 'Invalid issue type' });
  }
  if (priority !== undefined && !['Low', 'Normal', 'Medium', 'High'].includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority value' });
  }
  if (status !== undefined && !['todo', 'progress', 'review', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
  if (story_points !== undefined) {
    const pts = parseInt(story_points);
    if (isNaN(pts) || pts < 0) {
      return res.status(400).json({ error: 'Story points must be a non-negative number' });
    }
  }

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
    if (sprint_id !== undefined) { fields.push(`sprint_id = $${i++}`); values.push(sprint_id ? parseInt(sprint_id) : null); }

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
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid assignee or sprint reference' });
    }
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

// Get all sprints
app.get('/sprints', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sprints ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get one sprint
app.get('/sprints/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sprints WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create sprint
app.post('/sprints', requireAuth, async (req, res) => {
  const { name, start_date, end_date, goal } = req.body;
  if (!name || !start_date || !end_date) {
    return res.status(400).json({ error: 'Name, start date, and end date are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO sprints (name, start_date, end_date, goal)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, start_date, end_date, goal || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update sprint
app.put('/sprints/:id', requireAuth, async (req, res) => {
  const { name, start_date, end_date, goal } = req.body;
  try {
    const fields = [];
    const values = [];
    let i = 1;

    if (name !== undefined) { fields.push(`name = $${i++}`); values.push(name); }
    if (start_date !== undefined) { fields.push(`start_date = $${i++}`); values.push(start_date); }
    if (end_date !== undefined) { fields.push(`end_date = $${i++}`); values.push(end_date); }
    if (goal !== undefined) { fields.push(`goal = $${i++}`); values.push(goal); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields' });

    values.push(req.params.id);
    const { rowCount } = await pool.query(`UPDATE sprints SET ${fields.join(', ')} WHERE id = $${i}`, values);
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });

    const { rows } = await pool.query('SELECT * FROM sprints WHERE id = $1', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete sprint
app.delete('/sprints/:id', requireAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM sprints WHERE id = $1', [req.params.id]);
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
      CREATE TABLE IF NOT EXISTS sprints (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        start_date VARCHAR(50) NOT NULL,
        end_date VARCHAR(50) NOT NULL,
        goal TEXT
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL DEFAULT 'task',
        priority VARCHAR(50) NOT NULL DEFAULT 'Medium',
        status VARCHAR(50) NOT NULL DEFAULT 'todo',
        assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        story_points INTEGER DEFAULT 0,
        sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL
      )
    `);
    await pool.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL
    `).catch(() => {});
  } catch (err) {
    console.error('DB failed:', err.message);
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
