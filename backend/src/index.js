require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Auth & Access Control
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/permissions', require('./routes/permissions'));

// Projects (Multi-Repo Folders)
app.use('/api/projects', require('./routes/projects'));

// Application Routes
app.use('/api/nodes', require('./routes/nodes'));
app.use('/api/flows', require('./routes/flows'));
app.use('/api/connections', require('./routes/connections'));
app.use('/api/simulations', require('./routes/simulations'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/metrics', require('./routes/metrics'));

app.get('/api/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'db_unavailable' });
  }
});

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TechFlow API running on port ${PORT}`);
});
