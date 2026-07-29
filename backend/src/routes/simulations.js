const express = require('express');
const router = express.Router();
const { EventEmitter } = require('events');
const db = require('../db');
const { runSimulation } = require('../simulation/engine');

// In-process event bus for SSE
const simBus = new EventEmitter();
simBus.setMaxListeners(200);

// GET /api/simulations — list all simulations with flow & project metadata
router.get('/', async (req, res) => {
  try {
    const { project_id, flow_id, search } = req.query;
    const params = [];
    const conditions = [];

    if (project_id) {
      params.push(project_id);
      conditions.push(`f.project_id = $${params.length}`);
    }
    if (flow_id) {
      params.push(flow_id);
      conditions.push(`s.flow_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(f.name ILIKE $${params.length} OR p.name ILIKE $${params.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const queryText = `
      SELECT
        s.*,
        f.name AS flow_name,
        f.version AS flow_version,
        p.id AS project_id,
        p.name AS project_name,
        p.code AS project_code,
        p.color AS project_color,
        p.icon AS project_icon,
        (SELECT COUNT(*)::int FROM node_executions ne WHERE ne.simulation_id = s.id) AS node_count,
        (SELECT COUNT(*)::int FROM node_executions ne WHERE ne.simulation_id = s.id AND ne.status = 'error') AS error_count
      FROM simulations s
      JOIN flows f ON f.id = s.flow_id
      LEFT JOIN projects p ON p.id = f.project_id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT 100
    `;

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulations — create and start simulation
router.post('/', async (req, res) => {
  const { flow_id, input_data = {} } = req.body;
  if (!flow_id) return res.status(400).json({ error: 'flow_id is required' });

  try {
    const flowCheck = await db.query('SELECT id FROM flows WHERE id = $1', [flow_id]);
    if (!flowCheck.rows.length) return res.status(404).json({ error: 'Flow not found' });

    const result = await db.query(
      'INSERT INTO simulations (flow_id, input_data) VALUES ($1,$2) RETURNING *',
      [flow_id, JSON.stringify(input_data)]
    );
    const sim = result.rows[0];

    // Start simulation asynchronously
    setImmediate(() => {
      runSimulation(sim.id, (event) => {
        simBus.emit(`sim:${sim.id}`, event);
      }).catch((err) => {
        simBus.emit(`sim:${sim.id}`, { type: 'error', message: err.message, simulationId: sim.id });
      });
    });

    res.status(201).json(sim);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/simulations/:id/stream — SSE real-time updates
router.get('/:id/stream', async (req, res) => {
  const simId = parseInt(req.params.id);

  // Verify simulation exists
  const check = await db.query('SELECT id, status FROM simulations WHERE id = $1', [simId]);
  if (!check.rows.length) return res.status(404).json({ error: 'Not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  function send(event) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    if (event.type === 'complete' || event.type === 'error') {
      clearInterval(heartbeat);
      res.end();
    }
  }

  simBus.on(`sim:${simId}`, send);

  req.on('close', () => {
    clearInterval(heartbeat);
    simBus.off(`sim:${simId}`, send);
  });
});

// GET /api/simulations/:id — simulation detail + execution logs
router.get('/:id', async (req, res) => {
  try {
    const simRes = await db.query('SELECT * FROM simulations WHERE id = $1', [req.params.id]);
    if (!simRes.rows.length) return res.status(404).json({ error: 'Not found' });

    const logsRes = await db.query(
      `SELECT ne.*, fn.pos_x, fn.pos_y
       FROM node_executions ne
       LEFT JOIN flow_nodes fn ON fn.id = ne.flow_node_id
       WHERE ne.simulation_id = $1
       ORDER BY ne.id ASC`,
      [req.params.id]
    );

    res.json({ simulation: simRes.rows[0], logs: logsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/simulations/flow/:flowId — simulations for a flow
router.get('/flow/:flowId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM simulations WHERE flow_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.params.flowId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/simulations/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM simulations WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
