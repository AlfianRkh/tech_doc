require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/nodes', require('./routes/nodes'));
app.use('/api/flows', require('./routes/flows'));
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

app.listen(PORT, () => {
  console.log(`TechFlow API running on http://localhost:${PORT}`);
});
